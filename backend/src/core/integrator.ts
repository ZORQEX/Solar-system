import type { Body } from "./body.ts";

/** Recomputes and stores `acceleration` on every body (e.g. the gravity solver). */
export type AccelerationFn = (bodies: readonly Body[]) => void;

/** Velocity half-step: v += a·dt. Uses each body's current `acceleration`. */
export function kick(bodies: readonly Body[], dt: number): void {
  for (const b of bodies) {
    if (b.alive) b.velocity = b.velocity.add(b.acceleration.scale(dt));
  }
}

/** Position step: x += v·dt. */
export function drift(bodies: readonly Body[], dt: number): void {
  for (const b of bodies) {
    if (b.alive) b.position = b.position.add(b.velocity.scale(dt));
  }
}

/**
 * One Velocity-Verlet (kick–drift–kick / leapfrog) step.
 *
 * Precondition: every body's `acceleration` already holds a(t) for the current
 * positions. Postcondition: positions/velocities are advanced by `dt` and each
 * `acceleration` holds a(t+dt) — ready to be the a(t) of the next step.
 *
 * This integrator is symplectic, so energy error stays bounded over long runs
 * instead of drifting the way explicit Euler does.
 */
export function velocityVerletStep(
  bodies: readonly Body[],
  dt: number,
  recomputeAcceleration: AccelerationFn,
): void {
  const half = 0.5 * dt;
  kick(bodies, half); // v(t + ½dt)  using a(t)
  drift(bodies, dt); // x(t + dt)
  recomputeAcceleration(bodies); // a(t + dt)
  kick(bodies, half); // v(t + dt)   using a(t+dt)
}
