/** Public surface of the physics core. */
export { Vector3 } from "./vector3.ts";
export { Body } from "./body.ts";
export { OctreeNode } from "./octree.ts";
export {
  computeAccelerations,
  computeAccelerationsExact,
  type GravityOptions,
} from "./gravity.ts";
export {
  velocityVerletStep,
  kick,
  drift,
  type AccelerationFn,
} from "./integrator.ts";
export { resolveCollisions, isColliding, merge } from "./collisions.ts";
export {
  energyReport,
  totalKineticEnergy,
  totalPotentialEnergy,
  totalMomentum,
  type EnergyOptions,
} from "./energy.ts";
export {
  PhysicsEngine,
  type EngineConfig,
  type ForceField,
} from "./physics-engine.ts";
