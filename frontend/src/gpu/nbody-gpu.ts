/// <reference types="@webgpu/types" />
/**
 * Optional WebGPU accelerator for the brute-force O(N²) N-body force sum. Each
 * GPU invocation computes the softened acceleration on one body. Falls back to
 * an equivalent CPU implementation when WebGPU is unavailable, behind a single
 * {@link NBodyAccelerator} interface.
 *
 * Note: the CPU path is exact and tested by construction (same formula as the
 * backend core); the GPU path is verified to compile/build. Both use the same
 * softened law: a_i = G·Σ_j m_j (r_j−r_i)/(|r_j−r_i|²+ε²)^(3/2).
 */

export interface NBodyOptions {
  G: number;
  softening: number;
}

export interface NBodyAccelerator {
  readonly backend: "gpu" | "cpu";
  /** positions: xyz per body (length 3N); masses: length N. Returns xyz per body. */
  compute(positions: Float32Array, masses: Float32Array, opts: NBodyOptions): Promise<Float32Array>;
  dispose(): void;
}

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
}

/** Exact CPU reference (softened, O(N²)). */
export function cpuAccelerations(
  positions: Float32Array,
  masses: Float32Array,
  opts: NBodyOptions,
): Float32Array {
  const n = masses.length;
  const eps2 = opts.softening * opts.softening;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const xi = positions[i * 3]!;
    const yi = positions[i * 3 + 1]!;
    const zi = positions[i * 3 + 2]!;
    let ax = 0, ay = 0, az = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = positions[j * 3]! - xi;
      const dy = positions[j * 3 + 1]! - yi;
      const dz = positions[j * 3 + 2]! - zi;
      const distSq = dx * dx + dy * dy + dz * dz + eps2;
      const invDist = 1 / Math.sqrt(distSq);
      const f = opts.G * masses[j]! * invDist * invDist * invDist;
      ax += dx * f;
      ay += dy * f;
      az += dz * f;
    }
    out[i * 3] = ax;
    out[i * 3 + 1] = ay;
    out[i * 3 + 2] = az;
  }
  return out;
}

const WGSL = /* wgsl */ `
struct Params { n: u32, g: f32, eps2: f32, _pad: u32 };
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mass: array<f32>;
@group(0) @binding(3) var<storage, read_write> acc: array<vec4<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.n) { return; }
  let pi = pos[i].xyz;
  var a = vec3<f32>(0.0, 0.0, 0.0);
  for (var j: u32 = 0u; j < params.n; j = j + 1u) {
    if (j == i) { continue; }
    let d = pos[j].xyz - pi;
    let distSq = dot(d, d) + params.eps2;
    let invDist = inverseSqrt(distSq);
    let f = params.g * mass[j] * invDist * invDist * invDist;
    a = a + d * f;
  }
  acc[i] = vec4<f32>(a, 0.0);
}
`;

class CpuAccelerator implements NBodyAccelerator {
  readonly backend = "cpu" as const;
  async compute(positions: Float32Array, masses: Float32Array, opts: NBodyOptions): Promise<Float32Array> {
    return cpuAccelerations(positions, masses, opts);
  }
  dispose(): void {}
}

class GpuAccelerator implements NBodyAccelerator {
  readonly backend = "gpu" as const;
  constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPUComputePipeline,
  ) {}

  async compute(positions: Float32Array, masses: Float32Array, opts: NBodyOptions): Promise<Float32Array> {
    const n = masses.length;
    const device = this.device;

    // Pack positions into vec4 (std430 alignment).
    const packed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      packed[i * 4] = positions[i * 3]!;
      packed[i * 4 + 1] = positions[i * 3 + 1]!;
      packed[i * 4 + 2] = positions[i * 3 + 2]!;
    }

    const posBuf = device.createBuffer({ size: packed.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const massBuf = device.createBuffer({ size: Math.max(16, masses.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const accBuf = device.createBuffer({ size: n * 4 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const readBuf = device.createBuffer({ size: n * 4 * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

    // Copy masses into a fresh ArrayBuffer-backed array (the input may be a view
    // over a SharedArrayBuffer, which writeBuffer's typing rejects).
    const massData = new Float32Array(masses);
    device.queue.writeBuffer(posBuf, 0, packed);
    device.queue.writeBuffer(massBuf, 0, massData);
    const params = new ArrayBuffer(16);
    const dv = new DataView(params);
    dv.setUint32(0, n, true);
    dv.setFloat32(4, opts.G, true);
    dv.setFloat32(8, opts.softening * opts.softening, true);
    device.queue.writeBuffer(paramsBuf, 0, params);

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: posBuf } },
        { binding: 2, resource: { buffer: massBuf } },
        { binding: 3, resource: { buffer: accBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
    encoder.copyBufferToBuffer(accBuf, 0, readBuf, 0, n * 4 * 4);
    device.queue.submit([encoder.finish()]);

    await readBuf.mapAsync(GPUMapMode.READ);
    const mapped = new Float32Array(readBuf.getMappedRange().slice(0));
    readBuf.unmap();

    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      out[i * 3] = mapped[i * 4]!;
      out[i * 3 + 1] = mapped[i * 4 + 1]!;
      out[i * 3 + 2] = mapped[i * 4 + 2]!;
    }
    for (const b of [posBuf, massBuf, accBuf, paramsBuf, readBuf]) b.destroy();
    return out;
  }

  dispose(): void {
    this.device.destroy();
  }
}

/**
 * Build the best available accelerator: GPU when WebGPU is present and an
 * adapter can be acquired, otherwise the CPU implementation.
 */
export async function createNBodyAccelerator(): Promise<NBodyAccelerator> {
  if (isWebGPUAvailable()) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter?.requestDevice();
      if (device) {
        const module = device.createShaderModule({ code: WGSL });
        const pipeline = device.createComputePipeline({
          layout: "auto",
          compute: { module, entryPoint: "main" },
        });
        return new GpuAccelerator(device, pipeline);
      }
    } catch {
      /* fall through to CPU */
    }
  }
  return new CpuAccelerator();
}
