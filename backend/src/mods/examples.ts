import { Vector3 } from "../core/index.ts";
import type { Mod } from "./mod.ts";

/**
 * Example custom physics laws, demonstrating the `forceField` hook. These are
 * the kind of rule a user could ship as a mod.
 */

/** Linear velocity drag: a = -k·v. Bleeds energy out of the system. */
export function createDragMod(coefficient: number): Mod {
  return {
    id: "example.drag",
    name: `Velocity drag (k=${coefficient})`,
    forceField: (body) => body.velocity.scale(-coefficient),
  };
}

/**
 * Toy cosmological expansion: a repulsion that grows with distance from the
 * origin, a = H²·r — bodies drift apart over time.
 */
export function createExpansionMod(hubble: number): Mod {
  const h2 = hubble * hubble;
  return {
    id: "example.expansion",
    name: `Cosmological expansion (H=${hubble})`,
    forceField: (body) => body.position.scale(h2),
  };
}

/** Uniform external field, e.g. a constant pull toward one direction. */
export function createUniformFieldMod(acceleration: Vector3): Mod {
  return {
    id: "example.uniform-field",
    name: "Uniform field",
    forceField: () => acceleration,
  };
}
