/**
 * Cross-cutting types shared by the backend simulation and the frontend.
 *
 * No `enum`/`namespace` — they don't survive Node's native type-stripping.
 * Use string-literal unions and `const` objects.
 */

/** Kinds of gravitating bodies the simulator understands. */
export type BodyType =
  | "star"
  | "planet"
  | "moon"
  | "asteroid"
  | "comet"
  | "black-hole"
  | "neutron-star"
  | "gas-giant"
  | "generic";

export const BODY_TYPES = [
  "star",
  "planet",
  "moon",
  "asteroid",
  "comet",
  "black-hole",
  "neutron-star",
  "gas-giant",
  "generic",
] as const satisfies readonly BodyType[];

/**
 * Finer visual classification for solid/gaseous worlds, used only by the
 * frontend renderer to pick a surface palette and noise profile. Optional and
 * purely cosmetic — the physics core and wire protocol never depend on it.
 */
export type PlanetSubtype =
  // Named solar-system bodies get bespoke palettes/surfaces.
  | "terrestrial-earth"
  | "terrestrial-venus"
  | "barren-mars"
  | "barren-mercury"
  | "gas-giant-jupiter"
  | "gas-giant-saturn"
  | "ice-giant-uranus"
  | "ice-giant-neptune"
  | "moon"
  // Generic fallbacks derived from mass/radius for procedural/custom bodies.
  | "terrestrial"
  | "barren"
  | "ice-world"
  | "lava"
  | "ocean"
  | "gas-giant"
  | "generic";

/** A minimal serializable 3-vector (the wire/JSON form of a Vector3). */
export interface Vec3Data {
  x: number;
  y: number;
  z: number;
}

/** Serializable snapshot of a single body (scenario files, save games, wire). */
export interface BodyData {
  id: string;
  type: BodyType;
  /** kg */
  mass: number;
  /** m */
  radius: number;
  position: Vec3Data;
  velocity: Vec3Data;
  /** Optional display hints — never used by the physics core. */
  name?: string;
  color?: string;
  /** Optional cosmetic classification for the renderer (derived if absent). */
  subtype?: PlanetSubtype;
}

/** A complete initial condition that the engine can load. */
export interface ScenarioData {
  name: string;
  description?: string;
  /** Gravitational constant for this scenario (SI by default). */
  G?: number;
  /** Softening length in metres. */
  softening?: number;
  bodies: BodyData[];
}

/** Conserved/diagnostic quantities reported by the engine. */
export interface EnergyReport {
  kinetic: number;
  potential: number;
  total: number;
}
