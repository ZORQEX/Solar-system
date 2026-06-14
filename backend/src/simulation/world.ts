import { Body, PhysicsEngine, type EngineConfig } from "../core/index.ts";
import { Star, type Biosphere, type Civilization } from "../entities/index.ts";
import { SECONDS_PER_YEAR } from "../shared.ts";
import type { BodyData, ScenarioData } from "../shared.ts";

/** Serializable form of a Star entity. */
export interface StarSave {
  id: string;
  mass: number;
  ageYears: number;
  name?: string;
}

/** Complete, serializable save game. */
export interface WorldSave {
  name: string;
  timeSeconds: number;
  engine: EngineConfig;
  bodies: BodyData[];
  stars: StarSave[];
  biospheres: Biosphere[];
  civilizations: Civilization[];
}

/**
 * The full simulated world: the gravitating bodies (owned by the physics
 * engine) plus the entity registries layered on top of them — stars (which
 * evolve), biospheres and civilizations.
 *
 * Slow processes live here in `evolve()`: stellar aging, and the coupling that
 * turns a dying star's body into a black hole / neutron star.
 */
export class World {
  name: string;
  readonly physics: PhysicsEngine;
  /** Simulated time elapsed (seconds). */
  timeSeconds: number;

  readonly stars = new Map<string, Star>();
  readonly biospheres = new Map<string, Biosphere>();
  readonly civilizations = new Map<string, Civilization>();

  constructor(physics: PhysicsEngine, name = "Untitled Universe") {
    this.physics = physics;
    this.name = name;
    this.timeSeconds = 0;
  }

  registerStar(star: Star): void {
    this.stars.set(star.id, star);
  }

  registerBiosphere(biosphere: Biosphere): void {
    this.biospheres.set(biosphere.planetId, biosphere);
  }

  registerCivilization(civ: Civilization): void {
    this.civilizations.set(civ.id, civ);
  }

  private findBody(id: string): Body | undefined {
    return this.physics.bodies.find((b) => b.id === id && b.alive);
  }

  /**
   * Advance the slow, non-gravitational processes by `simSeconds`. Stars age;
   * when one crosses into a remnant stage its gravitating body is updated to
   * match (type + radius). Biosphere aging is tracked here; its dynamics arrive
   * with the evolution model in the AI module.
   */
  evolve(simSeconds: number): void {
    const years = simSeconds / SECONDS_PER_YEAR;

    for (const star of this.stars.values()) {
      if (star.evolve(years)) this.syncStarBody(star);
    }
    for (const bio of this.biospheres.values()) {
      bio.ageYears += years;
    }

    this.timeSeconds += simSeconds;
  }

  /** Reflect a star's current stage onto its physics body. */
  private syncStarBody(star: Star): void {
    const body = this.findBody(star.id);
    if (!body) return;
    body.type = star.currentBodyType();
    body.radius = star.radiusMeters();
  }

  toSave(): WorldSave {
    const stars: StarSave[] = [];
    for (const s of this.stars.values()) {
      stars.push({
        id: s.id,
        mass: s.initialMass,
        ageYears: s.ageYears,
        ...(s.name !== undefined ? { name: s.name } : {}),
      });
    }
    return {
      name: this.name,
      timeSeconds: this.timeSeconds,
      engine: { ...this.physics.config },
      bodies: this.physics.snapshot(),
      stars,
      biospheres: [...this.biospheres.values()].map((b) => ({ ...b })),
      civilizations: [...this.civilizations.values()].map((c) => ({ ...c })),
    };
  }

  static fromSave(save: WorldSave): World {
    const engine = new PhysicsEngine(
      save.bodies.map((d) => Body.fromData(d)),
      save.engine,
    );
    const world = new World(engine, save.name);
    world.timeSeconds = save.timeSeconds;

    for (const s of save.stars) {
      world.registerStar(
        new Star({
          id: s.id,
          mass: s.mass,
          ageYears: s.ageYears,
          ...(s.name !== undefined ? { name: s.name } : {}),
        }),
      );
    }
    for (const b of save.biospheres) world.registerBiosphere({ ...b });
    for (const c of save.civilizations) world.registerCivilization({ ...c });
    return world;
  }

  static fromScenario(scenario: ScenarioData): World {
    const engine = PhysicsEngine.fromScenario(scenario);
    return new World(engine, scenario.name);
  }
}
