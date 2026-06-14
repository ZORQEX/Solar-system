import { AU, EARTH_RADIUS, SOLAR_LUMINOSITY, STEFAN_BOLTZMANN } from "../shared.ts";

export type PlanetComposition = "rocky" | "iron" | "ice" | "gas" | "ocean";

/** Typical Bond albedo by composition (fraction of light reflected). */
const ALBEDO: Record<PlanetComposition, number> = {
  rocky: 0.3,
  iron: 0.2,
  ice: 0.6,
  gas: 0.5,
  ocean: 0.25,
};

/**
 * Inner/outer edge of a star's habitable zone, in AU, from a simple
 * effective-flux scaling: the boundaries scale as √(L/L☉). With Sun-like
 * luminosity this gives ≈ 0.95–1.37 AU, putting Earth comfortably inside.
 */
export function habitableZoneAU(luminosityWatts: number): {
  inner: number;
  outer: number;
} {
  const lRel = luminosityWatts / SOLAR_LUMINOSITY;
  return {
    inner: Math.sqrt(lRel / 1.1),
    outer: Math.sqrt(lRel / 0.53),
  };
}

/**
 * A planet. Orbital geometry lives in the physics `Body`; this entity carries
 * the bulk/thermal properties used for procedural generation and habitability.
 */
export class Planet {
  id: string;
  name: string | undefined;
  /** kg */
  mass: number;
  /** m */
  radius: number;
  composition: PlanetComposition;
  /** Semi-major axis in metres. */
  semiMajorAxis: number;

  constructor(params: {
    id: string;
    mass: number;
    radius: number;
    composition: PlanetComposition;
    semiMajorAxis: number;
    name?: string;
  }) {
    this.id = params.id;
    this.mass = params.mass;
    this.radius = params.radius;
    this.composition = params.composition;
    this.semiMajorAxis = params.semiMajorAxis;
    this.name = params.name;
  }

  get albedo(): number {
    return ALBEDO[this.composition];
  }

  get semiMajorAxisAU(): number {
    return this.semiMajorAxis / AU;
  }

  /**
   * Black-body equilibrium temperature (K) for a fast-rotating planet:
   *
   *   T = ( L·(1−A) / (16·π·σ·d²) )^(1/4)
   *
   * Earth (L☉, d = 1 AU, A = 0.3) comes out at ≈ 255 K, the textbook value.
   */
  equilibriumTemperatureK(starLuminosityWatts: number): number {
    const d = this.semiMajorAxis;
    const numerator = starLuminosityWatts * (1 - this.albedo);
    const denominator = 16 * Math.PI * STEFAN_BOLTZMANN * d * d;
    return Math.pow(numerator / denominator, 0.25);
  }

  /** True when the orbit sits inside the star's habitable zone. */
  isInHabitableZone(starLuminosityWatts: number): boolean {
    const hz = habitableZoneAU(starLuminosityWatts);
    const a = this.semiMajorAxisAU;
    return a >= hz.inner && a <= hz.outer;
  }

  /**
   * Heuristic habitability score in [0, 1], calibrated so Earth scores ≈ 1.
   * Rewards rocky/ocean worlds in the habitable zone whose equilibrium
   * temperature and size are close to Earth's (255 K, 1 R⊕). 0 means
   * uninhabitable.
   */
  habitabilityScore(starLuminosityWatts: number): number {
    if (!this.isInHabitableZone(starLuminosityWatts)) return 0;
    if (this.composition === "gas" || this.composition === "ice") return 0;

    // Temperature comfort: Gaussian centred on Earth's equilibrium temp (255 K).
    const teq = this.equilibriumTemperatureK(starLuminosityWatts);
    const tempScore = Math.exp(-((teq - 255) ** 2) / (2 * 40 ** 2));

    // Size comfort: Gaussian centred on 1 Earth radius (gravity/atmosphere proxy).
    const earthRadii = this.radius / EARTH_RADIUS;
    const sizeScore = Math.exp(-((earthRadii - 1) ** 2) / (2 * 0.5 ** 2));

    return Math.max(0, Math.min(1, tempScore * sizeScore));
  }
}
