import {
  G,
  SPEED_OF_LIGHT,
  SOLAR_MASS,
  SOLAR_RADIUS,
  SOLAR_LUMINOSITY,
  SUN_SURFACE_TEMPERATURE,
  STEFAN_BOLTZMANN,
  HYDROGEN_BURNING_LIMIT,
  SECONDS_PER_YEAR,
} from "../shared.ts";
import type { BodyType } from "../shared.ts";

/**
 * Life stages a star passes through. Which remnant it ends as is fixed by its
 * initial mass; how fast it gets there is set by the main-sequence lifetime.
 */
export type StarStage =
  | "brown-dwarf"
  | "main-sequence"
  | "red-giant"
  | "white-dwarf"
  | "neutron-star"
  | "black-hole";

/** Harvard spectral classification, hottest to coolest. */
export type SpectralClass = "O" | "B" | "A" | "F" | "G" | "K" | "M" | "L";

/** Temperature lower bounds (K) for each spectral class. */
const SPECTRAL_BOUNDS: ReadonlyArray<[SpectralClass, number]> = [
  ["O", 30000],
  ["B", 10000],
  ["A", 7500],
  ["F", 6000],
  ["G", 5200],
  ["K", 3700],
  ["M", 2400],
  ["L", 0],
];

/**
 * A star, parameterised by mass and age. All derived quantities use standard
 * (simplified) main-sequence scaling relations — accurate to order-of-magnitude,
 * which is what a galaxy-scale simulation needs.
 *
 * Note: these are *approximations*. The mass–luminosity, mass–radius and
 * lifetime relations are power-law fits, not detailed stellar models.
 */
export class Star {
  id: string;
  name: string | undefined;
  /** Initial (zero-age) mass in kg — fixes the eventual remnant type. */
  readonly initialMass: number;
  /** Current age in years. */
  ageYears: number;

  constructor(params: {
    id: string;
    mass: number;
    ageYears?: number;
    name?: string;
  }) {
    this.id = params.id;
    this.initialMass = params.mass;
    this.ageYears = params.ageYears ?? 0;
    this.name = params.name;
  }

  /** Initial mass in solar masses. */
  get massSolar(): number {
    return this.initialMass / SOLAR_MASS;
  }

  /** Main-sequence lifetime in years: t ≈ 10 Gyr · (M/M☉)^-2.5. */
  get mainSequenceLifetimeYears(): number {
    return 1e10 * Math.pow(this.massSolar, -2.5);
  }

  /** Eventual remnant, decided purely by initial mass. */
  remnantType(): StarStage {
    const m = this.massSolar;
    if (m < 0.08) return "brown-dwarf";
    if (m < 8) return "white-dwarf";
    if (m < 20) return "neutron-star";
    return "black-hole";
  }

  /** Current evolutionary stage given the star's age. */
  stage(): StarStage {
    if (this.initialMass < HYDROGEN_BURNING_LIMIT) return "brown-dwarf";
    const f = this.ageYears / this.mainSequenceLifetimeYears;
    if (f < 1) return "main-sequence";
    if (f < 1.1) return "red-giant";
    return this.remnantType();
  }

  /** Luminosity in watts, depending on the current stage. */
  luminosityWatts(): number {
    const mainSequence = SOLAR_LUMINOSITY * Math.pow(this.massSolar, 3.5);
    switch (this.stage()) {
      case "brown-dwarf":
        return SOLAR_LUMINOSITY * 1e-5;
      case "main-sequence":
        return mainSequence;
      case "red-giant":
        return mainSequence * 1000; // bloated and bright
      case "white-dwarf":
        return SOLAR_LUMINOSITY * 1e-3; // residual heat, fading
      case "neutron-star":
        return SOLAR_LUMINOSITY * 1e-1;
      case "black-hole":
        return 0;
    }
  }

  /** Radius in metres, depending on the current stage. */
  radiusMeters(): number {
    switch (this.stage()) {
      case "brown-dwarf":
        return SOLAR_RADIUS * 0.1;
      case "main-sequence":
        return SOLAR_RADIUS * Math.pow(this.massSolar, 0.8);
      case "red-giant":
        return SOLAR_RADIUS * 100;
      case "white-dwarf":
        return 7e6; // ~Earth-sized
      case "neutron-star":
        return 1.2e4; // ~12 km
      case "black-hole":
        return this.schwarzschildRadius();
    }
  }

  /** Effective temperature (K) from luminosity and radius (Stefan–Boltzmann). */
  temperatureK(): number {
    const L = this.luminosityWatts();
    const R = this.radiusMeters();
    if (L <= 0 || R <= 0) return 0;
    // Calibrate against the Sun so the constants line up exactly.
    const tSun = SUN_SURFACE_TEMPERATURE;
    const lRel = L / SOLAR_LUMINOSITY;
    const rRel = R / SOLAR_RADIUS;
    void STEFAN_BOLTZMANN; // physical basis: L = 4πR²σT⁴
    return tSun * Math.pow(lRel / (rRel * rRel), 0.25);
  }

  spectralClass(): SpectralClass {
    const t = this.temperatureK();
    for (const [cls, lo] of SPECTRAL_BOUNDS) {
      if (t >= lo) return cls;
    }
    return "L";
  }

  /** Event-horizon radius 2GM/c² (only physically meaningful for a black hole). */
  schwarzschildRadius(): number {
    return (2 * G * this.initialMass) / (SPEED_OF_LIGHT * SPEED_OF_LIGHT);
  }

  /** BodyType the physics engine should treat this star as right now. */
  currentBodyType(): BodyType {
    switch (this.stage()) {
      case "black-hole":
        return "black-hole";
      case "neutron-star":
        return "neutron-star";
      default:
        return "star";
    }
  }

  /** Advance the star's age. Returns true if its stage changed. */
  evolve(deltaYears: number): boolean {
    const before = this.stage();
    this.ageYears += deltaYears;
    return this.stage() !== before;
  }

  /** Convenience: age advanced by a number of seconds. */
  evolveSeconds(deltaSeconds: number): boolean {
    return this.evolve(deltaSeconds / SECONDS_PER_YEAR);
  }
}
