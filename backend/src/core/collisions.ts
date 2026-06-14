import type { Body } from "./body.ts";

/** Priority used to pick which body's identity/type survives a merge. */
const TYPE_RANK: Record<string, number> = {
  "black-hole": 6,
  "neutron-star": 5,
  star: 4,
  "gas-giant": 3,
  planet: 2,
  moon: 1,
  comet: 0,
  asteroid: 0,
  generic: 0,
};

/**
 * Merge `b` into `a` in place, conserving mass and linear momentum. `a` becomes
 * the survivor; `b` is marked dead. The survivor sits at the pair's center of
 * mass and moves at the center-of-mass velocity. Radius grows as if the two
 * (uniform-density) spheres combined their volume: r = (rₐ³ + r_b³)^(1/3).
 */
export function merge(a: Body, b: Body): void {
  const totalMass = a.mass + b.mass;
  const momentum = a.momentum().add(b.momentum());
  const com = a.position
    .scale(a.mass)
    .add(b.position.scale(b.mass))
    .scale(1 / totalMass);

  // Adopt the identity of the "more significant" body (mass first, then type).
  const aWins =
    a.mass > b.mass ||
    (a.mass === b.mass && (TYPE_RANK[a.type] ?? 0) >= (TYPE_RANK[b.type] ?? 0));
  if (!aWins) {
    a.id = b.id;
    a.type = b.type;
    a.name = b.name;
    a.color = b.color;
  }

  a.position = com;
  a.velocity = momentum.scale(1 / totalMass);
  a.mass = totalMass;
  a.radius = Math.cbrt(a.radius ** 3 + b.radius ** 3);
  b.alive = false;
}

/** True when two bodies' spheres overlap. */
export function isColliding(a: Body, b: Body): boolean {
  const sumR = a.radius + b.radius;
  return a.position.distanceSq(b.position) < sumR * sumR;
}

/**
 * Resolve all overlapping bodies by merging. A survivor may absorb several
 * bodies in one pass (chain collisions). Returns the number of bodies removed.
 *
 * Detection is currently O(N²); for large N this is the obvious place to drop in
 * a spatial hash, but merges are rare and correctness comes first.
 */
export function resolveCollisions(bodies: readonly Body[]): number {
  let merged = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    if (!a.alive) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (!b.alive) continue;
      if (isColliding(a, b)) {
        merge(a, b); // `a` keeps growing and may swallow further bodies
        merged++;
      }
    }
  }
  return merged;
}
