import { Vector3 } from "./vector3.ts";
import type { Body } from "./body.ts";
import type { EnergyReport } from "../shared.ts";
import { DEFAULT_SOFTENING, G as DEFAULT_G } from "../shared.ts";

export interface EnergyOptions {
  G?: number;
  softening?: number;
}

/** Total kinetic energy Σ ½·mᵢ·|vᵢ|² (J). */
export function totalKineticEnergy(bodies: readonly Body[]): number {
  let k = 0;
  for (const b of bodies) {
    if (b.alive) k += b.kineticEnergy();
  }
  return k;
}

/**
 * Total gravitational potential energy with Plummer softening, consistent with
 * the softened force used by the integrator:
 *
 *   U = -G Σ_{i<j} mᵢ·mⱼ / √(rᵢⱼ² + ε²)
 */
export function totalPotentialEnergy(
  bodies: readonly Body[],
  options?: EnergyOptions,
): number {
  const G = options?.G ?? DEFAULT_G;
  const softeningSq = (options?.softening ?? DEFAULT_SOFTENING) ** 2;

  let u = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    if (!a.alive) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (!b.alive) continue;
      const r = Math.sqrt(a.position.distanceSq(b.position) + softeningSq);
      u -= (G * a.mass * b.mass) / r;
    }
  }
  return u;
}

export function energyReport(
  bodies: readonly Body[],
  options?: EnergyOptions,
): EnergyReport {
  const kinetic = totalKineticEnergy(bodies);
  const potential = totalPotentialEnergy(bodies, options);
  return { kinetic, potential, total: kinetic + potential };
}

/** Total linear momentum Σ mᵢ·vᵢ (kg·m/s). */
export function totalMomentum(bodies: readonly Body[]): Vector3 {
  let v = Vector3.zero();
  for (const b of bodies) {
    if (b.alive) v = v.add(b.momentum());
  }
  return v;
}
