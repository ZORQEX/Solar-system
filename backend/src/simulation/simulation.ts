import { World } from "./world.ts";
import { TimeController } from "./time.ts";
import { generateStarSystem, Rng, type StarSystem } from "../entities/index.ts";
import type { Mod, ModContext } from "../mods/mod.ts";
import type { ScenarioData } from "../shared.ts";

export interface SimulationOptions {
  /** Target physics step size in simulated seconds. */
  fixedDt?: number;
  /** Upper bound on physics substeps per `simulate()` call (work cap). */
  maxSubstepsPerStep?: number;
  /** Initial wall-clock → sim-time scale (sim seconds per real second). */
  timeScale?: number;
  /** Seed for the deterministic RNG handed to mods. */
  seed?: number;
}

export interface AdvanceReport {
  /** Simulated seconds actually advanced. */
  simSeconds: number;
  /** Physics substeps taken. */
  steps: number;
  /** Physics step size used (sim seconds). */
  dt: number;
}

const DEFAULT_FIXED_DT = 3600; // 1 hour
const DEFAULT_MAX_SUBSTEPS = 512;

/**
 * Owns a {@link World} and advances it. The key primitive is {@link simulate},
 * which deterministically advances the world by an exact span of *simulated*
 * time, splitting it into physics substeps. {@link tick} layers real-time
 * playback (time scale + pause) on top.
 *
 * Multi-scale behaviour: a span is integrated in at most `maxSubstepsPerStep`
 * substeps. Short spans use steps of `fixedDt`; very long spans (e.g. eons)
 * stretch the step size instead of running unboundedly many steps — fast reach,
 * coarser accuracy, but the full span is always covered so entity time never
 * desyncs from physics time.
 */
export class Simulation {
  readonly world: World;
  readonly time: TimeController;
  fixedDt: number;
  maxSubsteps: number;

  readonly mods: Mod[] = [];
  private readonly modContext: ModContext;

  constructor(world: World, options: SimulationOptions = {}) {
    this.world = world;
    this.fixedDt = options.fixedDt ?? DEFAULT_FIXED_DT;
    this.maxSubsteps = options.maxSubstepsPerStep ?? DEFAULT_MAX_SUBSTEPS;
    this.time = new TimeController(options.timeScale ?? 1);
    this.modContext = { world, rng: new Rng(options.seed ?? 0x5eed) };
  }

  get timeSeconds(): number {
    return this.world.timeSeconds;
  }

  /**
   * Register a mod. Its custom physics law (if any) is installed on the engine
   * immediately, and its `onEvolve` hook fires on every subsequent span.
   */
  use(mod: Mod): this {
    this.mods.push(mod);
    if (mod.forceField) this.world.physics.forceFields.push(mod.forceField);
    mod.onRegister?.(this.modContext);
    return this;
  }

  /**
   * Deterministically advance the world by `simSeconds` of simulated time.
   * Returns a report of how it was integrated.
   */
  simulate(simSeconds: number): AdvanceReport {
    if (simSeconds <= 0) {
      return { simSeconds: 0, steps: 0, dt: 0 };
    }

    let steps = Math.ceil(simSeconds / this.fixedDt);
    if (steps > this.maxSubsteps) steps = this.maxSubsteps;
    const dt = simSeconds / steps;

    for (let i = 0; i < steps; i++) {
      this.world.physics.step(dt);
    }
    // Advance slow processes (and the canonical clock) by the full span.
    this.world.evolve(simSeconds);
    // Then let mods react (life evolution, custom rules, …).
    for (const mod of this.mods) mod.onEvolve?.(this.modContext, simSeconds);

    return { simSeconds, steps, dt };
  }

  /** Real-time playback: advance by `realDeltaSeconds` scaled by the time controller. */
  tick(realDeltaSeconds: number): AdvanceReport {
    const simSeconds = this.time.simDeltaForReal(realDeltaSeconds);
    return this.simulate(simSeconds);
  }

  static fromScenario(
    scenario: ScenarioData,
    options: SimulationOptions = {},
  ): Simulation {
    return new Simulation(World.fromScenario(scenario), options);
  }

  /** Build a simulation from a freshly generated star system, wiring entities in. */
  static fromStarSystem(
    system: StarSystem,
    options: SimulationOptions = {},
  ): Simulation {
    const world = World.fromScenario(system.scenario);
    world.registerStar(system.star);
    for (const planet of system.planets) world.registerPlanet(planet);
    if (system.biosphere) world.registerBiosphere(system.biosphere);
    return new Simulation(world, options);
  }

  /** Convenience: generate a system from a seed and wrap it in a simulation. */
  static fromSeed(seed: number, options: SimulationOptions = {}): Simulation {
    return Simulation.fromStarSystem(generateStarSystem(seed), { seed, ...options });
  }
}
