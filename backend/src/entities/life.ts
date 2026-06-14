/**
 * Biosphere and civilization data structures. These hold *state*; the dynamics
 * that move life from microbes to a spacefaring civilization live in the
 * evolution model (module 5, `ai/`). Keeping the data here lets the generator
 * seed a fresh biosphere on a habitable world.
 */

/** Major thresholds in the development of life on a world. */
export type BiosphereStage =
  | "none"
  | "abiogenesis"
  | "microbial"
  | "complex"
  | "intelligent"
  | "industrial"
  | "spacefaring";

export const BIOSPHERE_STAGES: readonly BiosphereStage[] = [
  "none",
  "abiogenesis",
  "microbial",
  "complex",
  "intelligent",
  "industrial",
  "spacefaring",
] as const;

export interface Biosphere {
  /** Host planet id. */
  planetId: string;
  stage: BiosphereStage;
  /** Fraction of viable surface colonised by life, [0, 1]. */
  biomassFraction: number;
  /** How long life has existed on this world, in years. */
  ageYears: number;
}

export function createBiosphere(planetId: string): Biosphere {
  return { planetId, stage: "abiogenesis", biomassFraction: 0, ageYears: 0 };
}

export interface Civilization {
  id: string;
  /** Planet the civilization originated on. */
  homePlanetId: string;
  name: string | undefined;
  /** Kardashev scale, continuous in [0, 3+]. */
  kardashev: number;
  population: number;
  /** Abstract technology index, monotonically non-decreasing under growth. */
  techLevel: number;
}
