/**
 * Deterministic, seedable pseudo-random generator (mulberry32).
 *
 * The physics core forbids `Math.random()`; all procedural generation goes
 * through an `Rng` so a given seed always reproduces the same universe.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid a zero state, which would stick mulberry32 in a degenerate cycle.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Log-uniform float in [min, max) — useful for masses/distances. */
  logRange(min: number, max: number): number {
    return Math.exp(this.range(Math.log(min), Math.log(max)));
  }

  /** True with probability `p`. */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[this.int(0, items.length - 1)]!;
  }

  /** Normally distributed value (Box–Muller). */
  gaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdDev * z;
  }

  /** A fresh independent generator derived deterministically from this one. */
  fork(): Rng {
    return new Rng((this.state ^ (this.next() * 0xffffffff)) >>> 0);
  }
}
