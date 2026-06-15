import * as THREE from "three";
import asteroidVertSrc from "./shaders/asteroid.vert.glsl?raw";
import asteroidFragSrc from "./shaders/asteroid.frag.glsl?raw";
import { withNoise } from "./noise/index.ts";

const ASTEROID_VERT = withNoise(asteroidVertSrc);

/**
 * A single `InstancedMesh` rendering many asteroid bodies in one draw call
 * (designed for 100–10000 instances). Bodies are mapped to instance slots via a
 * free-list so they can be added/removed dynamically; each slot carries a stable
 * per-instance seed. The factory drives transforms from body positions each
 * frame. The InstancedMesh sits at the origin — each instance matrix carries the
 * body's full scene-space transform (position + radius).
 */
export class AsteroidBelt {
  readonly object3D: THREE.InstancedMesh;
  private readonly geometry: THREE.IcosahedronGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly seedAttr: THREE.InstancedBufferAttribute;

  private readonly slotOf = new Map<string, number>();
  private readonly freeSlots: number[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private dirty = false;

  constructor(capacity = 2048) {
    this.geometry = new THREE.IcosahedronGeometry(1, 2);
    this.seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.geometry.setAttribute("aSeed", this.seedAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: ASTEROID_VERT,
      fragmentShader: asteroidFragSrc,
      uniforms: {
        uAmplitude: { value: 0.35 },
        uPeriod: { value: 0.5 },
        uColor: { value: new THREE.Color(0.55, 0.5, 0.45) },
        uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
        uAmbient: { value: 0.08 },
      },
    });

    this.object3D = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.object3D.frustumCulled = false;
    for (let i = 0; i < capacity; i++) this.object3D.setMatrixAt(i, this.hidden);
    this.object3D.instanceMatrix.needsUpdate = true;
    for (let i = capacity - 1; i >= 0; i--) this.freeSlots.push(i);
  }

  has(id: string): boolean {
    return this.slotOf.has(id);
  }

  get size(): number {
    return this.slotOf.size;
  }

  /** Reserve a slot for `id` (no-op if it already has one). Returns false if full. */
  add(id: string, seed: number): boolean {
    if (this.slotOf.has(id)) return true;
    const slot = this.freeSlots.pop();
    if (slot === undefined) return false; // at capacity
    this.slotOf.set(id, slot);
    this.seedAttr.setX(slot, seed);
    this.seedAttr.needsUpdate = true;
    return true;
  }

  /** Update a body's instance transform (scene-space position + radius). */
  setTransform(id: string, position: THREE.Vector3, radius: number): void {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.dummy.position.copy(position);
    this.dummy.scale.setScalar(radius);
    this.dummy.quaternion.identity();
    this.dummy.updateMatrix();
    this.object3D.setMatrixAt(slot, this.dummy.matrix);
    this.dirty = true;
  }

  remove(id: string): void {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.slotOf.delete(id);
    this.object3D.setMatrixAt(slot, this.hidden);
    this.freeSlots.push(slot);
    this.dirty = true;
  }

  /** Flush transform changes + refresh the sun position. Call once per frame. */
  update(sunPosition: THREE.Vector3): void {
    (this.material.uniforms.uSunPosition!.value as THREE.Vector3).copy(sunPosition);
    if (this.dirty) {
      this.object3D.instanceMatrix.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.object3D.dispose();
  }
}
