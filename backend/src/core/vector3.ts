import type { Vec3Data } from "../shared.ts";

/**
 * Immutable 3-component vector. Every method returns a new `Vector3`; instances
 * are never mutated. This keeps the physics math referentially transparent and
 * easy to test. Hot inner loops that genuinely need to avoid allocation use the
 * static `*Mut` helpers that write into a destination array.
 */
export class Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static from(data: Vec3Data): Vector3 {
    return new Vector3(data.x, data.y, data.z);
  }

  add(o: Vector3): Vector3 {
    return new Vector3(this.x + o.x, this.y + o.y, this.z + o.z);
  }

  sub(o: Vector3): Vector3 {
    return new Vector3(this.x - o.x, this.y - o.y, this.z - o.z);
  }

  scale(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  /** Element-wise negation. */
  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  dot(o: Vector3): number {
    return this.x * o.x + this.y * o.y + this.z * o.z;
  }

  cross(o: Vector3): Vector3 {
    return new Vector3(
      this.y * o.z - this.z * o.y,
      this.z * o.x - this.x * o.z,
      this.x * o.y - this.y * o.x,
    );
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  distanceSq(o: Vector3): number {
    const dx = this.x - o.x;
    const dy = this.y - o.y;
    const dz = this.z - o.z;
    return dx * dx + dy * dy + dz * dz;
  }

  distance(o: Vector3): number {
    return Math.sqrt(this.distanceSq(o));
  }

  /** Returns a unit vector; the zero vector is returned unchanged. */
  normalize(): Vector3 {
    const len = this.length();
    return len === 0 ? this : this.scale(1 / len);
  }

  equals(o: Vector3, epsilon = 0): boolean {
    return (
      Math.abs(this.x - o.x) <= epsilon &&
      Math.abs(this.y - o.y) <= epsilon &&
      Math.abs(this.z - o.z) <= epsilon
    );
  }

  isFinite(): boolean {
    return (
      Number.isFinite(this.x) &&
      Number.isFinite(this.y) &&
      Number.isFinite(this.z)
    );
  }

  toJSON(): Vec3Data {
    return { x: this.x, y: this.y, z: this.z };
  }

  toString(): string {
    return `(${this.x}, ${this.y}, ${this.z})`;
  }
}
