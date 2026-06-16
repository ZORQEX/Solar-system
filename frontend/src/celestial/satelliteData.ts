/**
 * Decorative satellite census for the six planets that host moons.
 *
 * Moons are NOT simulated bodies (the physics engine sees only the Sun,
 * planets, gas giants and asteroids). They exist purely as a cosmetic frontend
 * system — see {@link ./SatelliteSystem.ts} — that orbits each planet with
 * simple analytic Kepler motion. This file is the data that system consumes.
 *
 * Each parent has:
 *   - `majors`: named satellites with an individual colour and a real
 *     (representative) period + semi-major axis. Rendered as small instanced
 *     bodies. Distances are used only for *relative ordering*, never to scale.
 *   - `swarm`: a generic population (Jupiter/Saturn/Uranus/Neptune irregulars)
 *     with no per-moon data — synthetically distributed (count, colour spread,
 *     retrograde fraction, inclination range). Rendered as a point cloud.
 *
 * Totals match the known satellite counts: Earth 1, Mars 2, Jupiter 115,
 * Saturn 292, Uranus 27, Neptune 14 — 451 in all.
 */

/** A named satellite with bespoke colour and (representative) orbital data. */
export interface MajorSatellite {
  name: string;
  /** Orbital period in days. Negative = retrograde. */
  periodDays: number;
  /** Real semi-major axis in km — for relative ordering only, not to scale. */
  distanceKm: number;
  /** Hex colour string, e.g. "#e0a23c". */
  color: string;
  inclinationDeg: number;
}

/** A synthetic generic-moon population (irregular/captured moons). */
export interface SwarmConfig {
  count: number;
  baseColor: string;
  /** 0–1: hue/lightness variance applied per instance. */
  colorJitter: number;
  /** 0–1: fraction of the swarm that orbits backward (retrograde). */
  retrogradeFraction: number;
  /** Inclination spread [min, max] in degrees. */
  inclinationRangeDeg: [number, number];
}

/** All satellites of one parent planet. `parentName` matches `body.name`. */
export interface ParentSatelliteConfig {
  parentName: string;
  majors: MajorSatellite[];
  swarm: SwarmConfig;
}

export const SATELLITE_CONFIGS: readonly ParentSatelliteConfig[] = [
  // --- Earth (1, no swarm) ---
  {
    parentName: "Earth",
    majors: [
      { name: "Moon", periodDays: 27.32, distanceKm: 384400, color: "#9a9a9a", inclinationDeg: 5.1 },
    ],
    swarm: { count: 0, baseColor: "#888888", colorJitter: 0, retrogradeFraction: 0, inclinationRangeDeg: [0, 0] },
  },

  // --- Mars (2, no swarm) ---
  {
    parentName: "Mars",
    majors: [
      { name: "Phobos", periodDays: 0.3189, distanceKm: 9377, color: "#6b5a4a", inclinationDeg: 1.1 },
      { name: "Deimos", periodDays: 1.263, distanceKm: 23460, color: "#7a6a5a", inclinationDeg: 1.8 },
    ],
    swarm: { count: 0, baseColor: "#6b5a4a", colorJitter: 0, retrogradeFraction: 0, inclinationRangeDeg: [0, 0] },
  },

  // --- Jupiter (115 = 4 majors + 111 swarm) ---
  {
    parentName: "Jupiter",
    majors: [
      { name: "Io", periodDays: 1.769, distanceKm: 421800, color: "#e0a23c", inclinationDeg: 0.05 },
      { name: "Europa", periodDays: 3.551, distanceKm: 671100, color: "#d9e8f0", inclinationDeg: 0.47 },
      { name: "Ganymede", periodDays: 7.155, distanceKm: 1070400, color: "#8a7b6b", inclinationDeg: 0.2 },
      { name: "Callisto", periodDays: 16.689, distanceKm: 1882700, color: "#4a4540", inclinationDeg: 0.205 },
    ],
    // Jupiter's irregulars skew retrograde + high-inclination — population
    // pattern, not exact per-moon data.
    swarm: { count: 111, baseColor: "#7a6a5a", colorJitter: 0.25, retrogradeFraction: 0.55, inclinationRangeDeg: [5, 50] },
  },

  // --- Saturn (292 = 9 majors + 283 swarm) ---
  {
    parentName: "Saturn",
    majors: [
      { name: "Mimas", periodDays: 0.942, distanceKm: 185500, color: "#b8b4ac", inclinationDeg: 1.57 },
      { name: "Enceladus", periodDays: 1.37, distanceKm: 238000, color: "#f5f5f0", inclinationDeg: 0.02 },
      { name: "Tethys", periodDays: 1.888, distanceKm: 294700, color: "#d8d4cc", inclinationDeg: 1.86 },
      { name: "Dione", periodDays: 2.737, distanceKm: 377400, color: "#c8c4bc", inclinationDeg: 0.02 },
      { name: "Rhea", periodDays: 4.518, distanceKm: 527000, color: "#bcb8b0", inclinationDeg: 0.35 },
      { name: "Titan", periodDays: 15.945, distanceKm: 1221900, color: "#d9a85c", inclinationDeg: 0.33 },
      { name: "Hyperion", periodDays: 21.28, distanceKm: 1481000, color: "#8a7a68", inclinationDeg: 0.43 },
      { name: "Iapetus", periodDays: 79.33, distanceKm: 3561300, color: "#c8c2b8", inclinationDeg: 15.47 },
      { name: "Phoebe", periodDays: -545, distanceKm: 12952000, color: "#5a5048", inclinationDeg: 175.2 },
    ],
    swarm: { count: 283, baseColor: "#c0bcb0", colorJitter: 0.15, retrogradeFraction: 0.3, inclinationRangeDeg: [0, 60] },
  },

  // --- Uranus (27 = 5 majors + 22 swarm) ---
  {
    parentName: "Uranus",
    majors: [
      { name: "Miranda", periodDays: 1.413, distanceKm: 129900, color: "#8a8880", inclinationDeg: 4.34 },
      { name: "Ariel", periodDays: 2.52, distanceKm: 190900, color: "#c8c8c0", inclinationDeg: 0.04 },
      { name: "Umbriel", periodDays: 4.144, distanceKm: 266000, color: "#4a4845", inclinationDeg: 0.13 },
      { name: "Titania", periodDays: 8.706, distanceKm: 436300, color: "#9a9890", inclinationDeg: 0.08 },
      { name: "Oberon", periodDays: 13.46, distanceKm: 583500, color: "#8a8278", inclinationDeg: 0.07 },
    ],
    swarm: { count: 22, baseColor: "#6a7078", colorJitter: 0.2, retrogradeFraction: 0.4, inclinationRangeDeg: [5, 90] },
  },

  // --- Neptune (14 = 2 majors + 7 regulars + 5 swarm) ---
  {
    parentName: "Neptune",
    majors: [
      { name: "Triton", periodDays: -5.877, distanceKm: 354800, color: "#d8a8a0", inclinationDeg: 156.9 }, // retrograde
      { name: "Nereid", periodDays: 360.13, distanceKm: 5513400, color: "#8a8a88", inclinationDeg: 7.23 },
      { name: "Naiad", periodDays: 0.294, distanceKm: 48200, color: "#707070", inclinationDeg: 4.75 },
      { name: "Thalassa", periodDays: 0.311, distanceKm: 50100, color: "#707070", inclinationDeg: 0.21 },
      { name: "Despina", periodDays: 0.335, distanceKm: 52500, color: "#707070", inclinationDeg: 0.07 },
      { name: "Galatea", periodDays: 0.429, distanceKm: 62000, color: "#707070", inclinationDeg: 0.05 },
      { name: "Larissa", periodDays: 0.555, distanceKm: 73500, color: "#707070", inclinationDeg: 0.2 },
      { name: "Hippocamp", periodDays: 0.951, distanceKm: 105300, color: "#707070", inclinationDeg: 0.13 },
      { name: "Proteus", periodDays: 1.122, distanceKm: 117600, color: "#707070", inclinationDeg: 0.04 },
    ],
    // Halimede, Sao, Laomedeia, Psamathe, Neso — far irregulars; synthetic.
    swarm: { count: 5, baseColor: "#585860", colorJitter: 0.2, retrogradeFraction: 0.5, inclinationRangeDeg: [25, 140] },
  },
] as const;

/** Look up a parent's satellite config by body name (case-insensitive). */
export function satelliteConfigFor(parentName: string): ParentSatelliteConfig | undefined {
  const key = parentName.toLowerCase();
  return SATELLITE_CONFIGS.find((c) => c.parentName.toLowerCase() === key);
}
