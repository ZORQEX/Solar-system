import { Body } from "./body.ts";
import { Vector3 } from "./vector3.ts";
import { computeAccelerations, type GravityOptions } from "./gravity.ts";
import { velocityVerletStep } from "./integrator.ts";
import { resolveCollisions } from "./collisions.ts";
import { energyReport, totalMomentum } from "./energy.ts";
import { DEFAULT_SOFTENING, DEFAULT_THETA, G as DEFAULT_G } from "../shared.ts";
import type { BodyData, EnergyReport, ScenarioData } from "../shared.ts";

export interface EngineConfig {
  G: number;
  theta: number;
  softening: number;
  /** Merge bodies whose spheres overlap. On by default. */
  collisions: boolean;
}

const DEFAULT_CONFIG: EngineConfig = {
  G: DEFAULT_G,
  theta: DEFAULT_THETA,
  softening: DEFAULT_SOFTENING,
  collisions: true,
};

/**
 * Authoritative N-body simulation. Owns the body set and advances it with a
 * Barnes–Hut gravity solver and a symplectic Velocity-Verlet integrator.
 *
 * Determinism: given the same initial bodies, config and `dt` sequence, the
 * evolution is reproducible — no hidden randomness lives here.
 */
export class PhysicsEngine {
  bodies: Body[];
  readonly config: EngineConfig;

  /** Simulated time elapsed (seconds). */
  time = 0;
  /** Number of completed steps. */
  steps = 0;

  private accelInitialized = false;

  constructor(bodies: Body[] = [], config: Partial<EngineConfig> = {}) {
    this.bodies = bodies;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private gravityOptions(): GravityOptions {
    return {
      G: this.config.G,
      theta: this.config.theta,
      softening: this.config.softening,
    };
  }

  addBody(body: Body): void {
    this.bodies.push(body);
    this.accelInitialized = false; // force a fresh a(t) before the next step
  }

  /** Number of bodies still alive. */
  get count(): number {
    let n = 0;
    for (const b of this.bodies) if (b.alive) n++;
    return n;
  }

  /**
   * Advance the simulation by `dt` seconds.
   *
   * The integrator needs a(t) at entry. We compute it lazily on the first step
   * (and again after any merge, since the body set changed) so the symplectic
   * kick–drift–kick invariant always holds.
   */
  step(dt: number): void {
    const opts = this.gravityOptions();

    if (!this.accelInitialized) {
      computeAccelerations(this.bodies, opts);
      this.accelInitialized = true;
    }

    velocityVerletStep(this.bodies, dt, (bs) => computeAccelerations(bs, opts));

    if (this.config.collisions) {
      const merged = resolveCollisions(this.bodies);
      if (merged > 0) {
        this.bodies = this.bodies.filter((b) => b.alive);
        // Body set changed: refresh a(t) for the next step's first kick.
        computeAccelerations(this.bodies, opts);
      }
    }

    this.time += dt;
    this.steps += 1;
  }

  /** Run `n` steps of size `dt`. */
  run(n: number, dt: number): void {
    for (let i = 0; i < n; i++) this.step(dt);
  }

  energy(): EnergyReport {
    return energyReport(this.bodies, {
      G: this.config.G,
      softening: this.config.softening,
    });
  }

  totalMomentum(): Vector3 {
    return totalMomentum(this.bodies);
  }

  totalMass(): number {
    let m = 0;
    for (const b of this.bodies) if (b.alive) m += b.mass;
    return m;
  }

  /** Serializable snapshot of all alive bodies. */
  snapshot(): BodyData[] {
    return this.bodies.filter((b) => b.alive).map((b) => b.toData());
  }

  static fromScenario(scenario: ScenarioData): PhysicsEngine {
    const bodies = scenario.bodies.map((d) => Body.fromData(d));
    const config: Partial<EngineConfig> = {};
    if (scenario.G !== undefined) config.G = scenario.G;
    if (scenario.softening !== undefined) config.softening = scenario.softening;
    return new PhysicsEngine(bodies, config);
  }
}
