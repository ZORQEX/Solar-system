import { Rng } from "../entities/random.ts";
import {
  BIOSPHERE_STAGES,
  type Biosphere,
  type BiosphereStage,
  type Civilization,
  type Planet,
  type Star,
} from "../entities/index.ts";
import { NeuralNetwork } from "./neural-network.ts";

/**
 * Minimal registries the life model operates on. The simulation's `World`
 * satisfies this structurally, so this module never imports the simulation
 * layer (keeping the dependency arrow one-way: simulation → ai).
 */
export interface LifeWorld {
  stars: Map<string, Star>;
  planets: Map<string, Planet>;
  biospheres: Map<string, Biosphere>;
  civilizations: Map<string, Civilization>;
}

/** Mean dwell time (years) before life leaves each stage, at habitability 1. */
const STAGE_MEAN_YEARS: Record<BiosphereStage, number> = {
  none: Infinity,
  abiogenesis: 4e8,
  microbial: 1.2e9,
  complex: 6e8,
  intelligent: 5e6,
  industrial: 2e4,
  spacefaring: Infinity,
};

function nextStage(stage: BiosphereStage): BiosphereStage {
  const i = BIOSPHERE_STAGES.indexOf(stage);
  return BIOSPHERE_STAGES[Math.min(i + 1, BIOSPHERE_STAGES.length - 1)]!;
}

/** Step a biosphere back one stage, but never below an established microbial floor. */
function regressStage(stage: BiosphereStage): BiosphereStage {
  const floor = BIOSPHERE_STAGES.indexOf("microbial");
  const i = BIOSPHERE_STAGES.indexOf(stage);
  return BIOSPHERE_STAGES[Math.max(floor, i - 1)]!;
}

/** Mean interval (years) between mass-extinction events on a living world. */
const MEAN_EXTINCTION_YEARS = 2e8;

/**
 * Advance one biosphere by `years`. Progress is gated by the planet's
 * habitability: a comfortable world races through the stages, a marginal one
 * crawls, and a hostile world (score 0) sees its biomass decay. Returns the
 * resulting stage.
 */
export function evolveBiosphere(
  bio: Biosphere,
  planet: Planet,
  starLuminosityWatts: number,
  years: number,
  rng: Rng,
): BiosphereStage {
  bio.ageYears += years;
  const hab = planet.habitabilityScore(starLuminosityWatts);

  if (hab <= 0) {
    bio.biomassFraction *= Math.exp(-years / 5e8); // hostile: life recedes
    return bio.stage;
  }

  // Rare catastrophes (impacts, supervolcanism, …) set life back. Applied
  // before regrowth so a long span recovers within the same step.
  const extinctionProb = 1 - Math.exp(-years / MEAN_EXTINCTION_YEARS);
  if (rng.next() < extinctionProb) {
    bio.biomassFraction *= 0.2;
    if (rng.bool(0.3)) bio.stage = regressStage(bio.stage);
  }

  // Biomass saturates toward full coverage.
  const growthTime = 2e7 / hab;
  bio.biomassFraction += (1 - bio.biomassFraction) * (1 - Math.exp(-years / growthTime));

  // Stage transitions; cascade when the span dwarfs the dwell time.
  let guard = 0;
  while (bio.stage !== "spacefaring" && guard++ < BIOSPHERE_STAGES.length) {
    const mean = STAGE_MEAN_YEARS[bio.stage] / hab;
    if (!Number.isFinite(mean)) break;
    const p = 1 - Math.exp(-years / mean);
    if (bio.biomassFraction > 0.2 && rng.next() < p) bio.stage = nextStage(bio.stage);
    else break;
  }
  return bio.stage;
}

/** True once a biosphere is advanced enough to harbour a civilization. */
function isSentient(stage: BiosphereStage): boolean {
  return stage === "intelligent" || stage === "industrial" || stage === "spacefaring";
}

/** Conditions a civilization develops under. */
export interface CivEnvironment {
  /** Current home-world habitability [0, 1]. Low values cause decline. */
  habitability?: number;
  /** Optional behaviour network modulating the growth drive. */
  brain?: NeuralNetwork;
}

/**
 * Advance one civilization by `years`. On a thriving world: logistic population
 * growth toward a Kardashev-scaled carrying capacity, saturating tech, and a
 * Kardashev level derived from tech. On a hostile world (e.g. after its star
 * dies) the civilization declines and loses knowledge — and may collapse.
 */
export function evolveCivilization(
  civ: Civilization,
  years: number,
  env: CivEnvironment = {},
): void {
  const hab = env.habitability ?? 1;

  if (hab <= 0.05) {
    // Home world no longer supports it: population crashes, tech slowly lost.
    civ.population *= Math.exp(-years / 2e7);
    civ.techLevel *= Math.exp(-years / 5e8);
    civ.kardashev = Math.min(civ.kardashev, civ.techLevel / 33.3);
    return;
  }

  const capacity = 1e10 * (1 + 5 * civ.kardashev);

  // Growth drive scales with habitability, optionally shaped by a brain net.
  let drive = hab;
  if (env.brain) {
    const popNorm = Math.min(1, civ.population / capacity);
    const techNorm = Math.min(1, civ.techLevel / 100);
    const out = env.brain.forward([civ.kardashev / 3, popNorm, techNorm]);
    drive *= 0.5 + (out[0]! + 1) / 2; // tanh(-1..1) -> 0.5..1.5
  }

  // Logistic population (Euler step, clamped so big spans stay well-behaved).
  const r = 1e-6 * drive;
  const p = civ.population;
  civ.population = Math.max(
    1,
    Math.min(capacity, p + r * p * (1 - p / capacity) * years),
  );

  // Tech saturates toward a cap; Kardashev follows tech.
  const techCap = 100;
  civ.techLevel += (techCap - civ.techLevel) * (1 - Math.exp(-years / (5e5 / Math.max(drive, 1e-3))));
  civ.kardashev = Math.min(3, civ.techLevel / 33.3);
}

/** Population below which a civilization is considered collapsed and removed. */
const COLLAPSE_POPULATION = 100;

/**
 * Advance all life in a world by `years`: evolve every biosphere, spawn a
 * civilization when one becomes sentient, then evolve every civilization.
 * Deterministic in `rng`.
 */
export function advanceLife(world: LifeWorld, years: number, rng: Rng): void {
  // Host illumination = the brightest star in the world.
  let starLuminosity = 0;
  for (const star of world.stars.values()) {
    starLuminosity = Math.max(starLuminosity, star.luminosityWatts());
  }

  for (const bio of world.biospheres.values()) {
    const planet = world.planets.get(bio.planetId);
    if (!planet) continue;
    const stage = evolveBiosphere(bio, planet, starLuminosity, years, rng);

    const civId = `${bio.planetId}-civ`;
    if (isSentient(stage) && !world.civilizations.has(civId)) {
      world.civilizations.set(civId, {
        id: civId,
        homePlanetId: bio.planetId,
        name: planet.name,
        kardashev: 0,
        population: 1000,
        techLevel: 0.1,
      });
    }
  }

  const collapsed: string[] = [];
  for (const civ of world.civilizations.values()) {
    const planet = world.planets.get(civ.homePlanetId);
    const habitability = planet ? planet.habitabilityScore(starLuminosity) : 0;
    evolveCivilization(civ, years, { habitability });
    if (civ.population < COLLAPSE_POPULATION) collapsed.push(civ.id);
  }
  // Remove collapsed civilizations after the loop (don't mutate while iterating).
  for (const id of collapsed) world.civilizations.delete(id);
}
