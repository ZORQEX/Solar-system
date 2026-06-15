/// <reference types="@webgpu/types" />
/**
 * GPU N-body integrator (Part 1). Runs the gravity + integration step entirely
 * on the GPU with double-buffered (ping-pong) storage buffers, so positions can
 * be fed straight into a render pipeline without a CPU round-trip
 * (`getPositionBuffer()`), or read back asynchronously (`readback()`).
 *
 * At the project's current scale (<50 bodies) this is a full O(N²) pass, which
 * is what Part 4 prescribes for small N. A GPU Barnes-Hut path would slot in
 * here for N > 1000.
 *
 * Note: positions are stored as f32. SI metres (~1e11) keep ~10 km of precision
 * at f32 — fine for visualization/prediction; the server stays authoritative.
 */
import type { BodyData } from "../shared.ts";

const FLOATS_PER_BODY = 12; // 3 × vec4<f32> (position, velocity, acceleration)
const BYTES_PER_BODY = FLOATS_PER_BODY * 4; // 48
const PARAMS_BYTES = 16; // u32 + 3×f32, padded to 16
const WORKGROUP_SIZE = 64; // optimal for most GPUs — do not change

const COMPUTE_WGSL = /* wgsl */ `
struct Body {
  position: vec4<f32>,     // xyz = position, w = mass
  velocity: vec4<f32>,     // xyz = velocity, w = radius
  acceleration: vec4<f32>,
};

struct Params {
  numBodies: u32,
  dt: f32,
  G: f32,
  softening: f32,
};

@group(0) @binding(0) var<storage, read> bodiesIn: array<Body>;
@group(0) @binding(1) var<storage, read_write> bodiesOut: array<Body>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.numBodies) { return; }

  var acc = vec3<f32>(0.0);
  let pi = bodiesIn[i].position.xyz;

  for (var j = 0u; j < params.numBodies; j = j + 1u) {
    if (i == j) { continue; }
    let pj = bodiesIn[j].position.xyz;
    let mj = bodiesIn[j].position.w;
    let r = pj - pi;
    let dist2 = dot(r, r) + params.softening * params.softening;
    let dist = sqrt(dist2);
    acc += r * (params.G * mj / (dist2 * dist));
  }

  // Semi-implicit (symplectic) Euler integration.
  let v = bodiesIn[i].velocity.xyz + acc * params.dt;
  let p = pi + v * params.dt;

  bodiesOut[i].position = vec4<f32>(p, bodiesIn[i].position.w);
  bodiesOut[i].velocity = vec4<f32>(v, bodiesIn[i].velocity.w);
  bodiesOut[i].acceleration = vec4<f32>(acc, 0.0);
}
`;

export interface NBodyComputeOptions {
  G?: number;
  softening?: number;
}

export class NBodyCompute {
  private device!: GPUDevice;
  private pipeline!: GPUComputePipeline;
  private bufferA!: GPUBuffer;
  private bufferB!: GPUBuffer;
  private paramsBuffer!: GPUBuffer;
  private readBuffer!: GPUBuffer;
  private bindAToB!: GPUBindGroup;
  private bindBToA!: GPUBindGroup;

  private meta: BodyData[] = [];
  private count = 0;
  private current: 0 | 1 = 0; // which buffer (0=A, 1=B) holds the live state
  private G = 6.6743e-11;
  private softening = 1e7;
  private readbackBusy = false;

  // Optional GPU timestamp timing (Part 4 performance overlay).
  private querySet: GPUQuerySet | null = null;
  private tsResolve: GPUBuffer | null = null;
  private tsRead: GPUBuffer | null = null;
  private tsBusy = false;
  /** Last measured compute time in ms (0 if timestamps unavailable). */
  lastComputeMs = 0;

  async init(device: GPUDevice, bodies: BodyData[], options: NBodyComputeOptions = {}): Promise<void> {
    this.device = device;
    this.G = options.G ?? this.G;
    this.softening = options.softening ?? this.softening;
    this.count = bodies.length;
    this.meta = bodies.map((b) => ({ ...b }));

    const data = this.pack(bodies);
    const size = Math.max(BYTES_PER_BODY, data.byteLength);
    const storageUsage =
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX;

    this.bufferA = device.createBuffer({ size, usage: storageUsage });
    this.bufferB = device.createBuffer({ size, usage: storageUsage });
    device.queue.writeBuffer(this.bufferA, 0, data);

    this.paramsBuffer = device.createBuffer({ size: PARAMS_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.readBuffer = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

    const module = device.createShaderModule({ code: COMPUTE_WGSL });
    this.pipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } });

    const layout = this.pipeline.getBindGroupLayout(0);
    this.bindAToB = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.bufferA } },
        { binding: 1, resource: { buffer: this.bufferB } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
    this.bindBToA = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.bufferB } },
        { binding: 1, resource: { buffer: this.bufferA } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });

    if (device.features.has("timestamp-query")) {
      try {
        this.querySet = device.createQuerySet({ type: "timestamp", count: 2 });
        this.tsResolve = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
        this.tsRead = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      } catch {
        this.querySet = null;
      }
    }
  }

  get numBodies(): number {
    return this.count;
  }

  /** The storage buffer holding the live state (Body array) — use as instance buffer. */
  getPositionBuffer(): GPUBuffer {
    return this.current === 0 ? this.bufferA : this.bufferB;
  }

  /** Run one compute pass (read live buffer → write the other, then swap). */
  step(dt: number): void {
    const params = new ArrayBuffer(PARAMS_BYTES);
    const dv = new DataView(params);
    dv.setUint32(0, this.count, true);
    dv.setFloat32(4, dt, true);
    dv.setFloat32(8, this.G, true);
    dv.setFloat32(12, this.softening, true);
    this.device.queue.writeBuffer(this.paramsBuffer, 0, params);

    const bindGroup = this.current === 0 ? this.bindAToB : this.bindBToA;
    const encoder = this.device.createCommandEncoder();
    const useTs = this.querySet !== null && this.tsResolve !== null && !this.tsBusy;
    const pass = encoder.beginComputePass(
      useTs
        ? { timestampWrites: { querySet: this.querySet!, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } }
        : undefined,
    );
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.count / WORKGROUP_SIZE));
    pass.end();
    if (useTs && this.tsResolve && this.tsRead) {
      encoder.resolveQuerySet(this.querySet!, 0, 2, this.tsResolve, 0);
      encoder.copyBufferToBuffer(this.tsResolve, 0, this.tsRead, 0, 16);
    }
    this.device.queue.submit([encoder.finish()]);
    this.current = this.current === 0 ? 1 : 0;

    if (useTs) this.pollTimestamps();
  }

  private pollTimestamps(): void {
    if (!this.tsRead) return;
    this.tsBusy = true;
    this.tsRead
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        const ticks = new BigUint64Array(this.tsRead!.getMappedRange().slice(0));
        const ns = Number(ticks[1]! - ticks[0]!);
        if (Number.isFinite(ns) && ns >= 0) this.lastComputeMs = ns / 1e6;
        this.tsRead!.unmap();
        this.tsBusy = false;
      })
      .catch(() => {
        this.tsBusy = false;
      });
  }

  /** Read the live state back to CPU, merged onto the original metadata. */
  async readback(): Promise<BodyData[]> {
    if (this.readbackBusy) return this.meta;
    this.readbackBusy = true;
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.getPositionBuffer(), 0, this.readBuffer, 0, this.count * BYTES_PER_BODY);
    this.device.queue.submit([encoder.finish()]);
    await this.readBuffer.mapAsync(GPUMapMode.READ);
    const f = new Float32Array(this.readBuffer.getMappedRange().slice(0));
    this.readBuffer.unmap();
    this.readbackBusy = false;

    return this.meta.map((m, i) => {
      const o = i * FLOATS_PER_BODY;
      return {
        ...m,
        mass: f[o + 3] ?? m.mass,
        radius: f[o + 7] ?? m.radius,
        position: { x: f[o] ?? 0, y: f[o + 1] ?? 0, z: f[o + 2] ?? 0 },
        velocity: { x: f[o + 4] ?? 0, y: f[o + 5] ?? 0, z: f[o + 6] ?? 0 },
      };
    });
  }

  /**
   * Re-upload authoritative state (server sync). Requires the same body count;
   * if it changed, the caller should re-init (the buffers are fixed-size).
   */
  setBodies(bodies: BodyData[]): boolean {
    if (bodies.length !== this.count) return false;
    this.meta = bodies.map((b) => ({ ...b }));
    this.device.queue.writeBuffer(this.getPositionBuffer(), 0, this.pack(bodies));
    return true;
  }

  dispose(): void {
    this.bufferA?.destroy();
    this.bufferB?.destroy();
    this.paramsBuffer?.destroy();
    this.readBuffer?.destroy();
    this.tsResolve?.destroy();
    this.tsRead?.destroy();
    this.querySet?.destroy();
  }

  private pack(bodies: BodyData[]): Float32Array<ArrayBuffer> {
    const arr = new Float32Array(bodies.length * FLOATS_PER_BODY);
    bodies.forEach((b, i) => {
      const o = i * FLOATS_PER_BODY;
      arr[o] = b.position.x;
      arr[o + 1] = b.position.y;
      arr[o + 2] = b.position.z;
      arr[o + 3] = b.mass;
      arr[o + 4] = b.velocity.x;
      arr[o + 5] = b.velocity.y;
      arr[o + 6] = b.velocity.z;
      arr[o + 7] = b.radius;
      // acceleration (o+8..o+11) left at 0
    });
    return arr;
  }
}
