/**
 * Official NASA/JPL moon data for the Tier 1 (major, full physics + visuals) and
 * Tier 2 (named, physics + simple visuals) moons. Values — mass (kg), radius (m),
 * semiMajorAxis (m), eccentricity — are from the NASA planetary-satellite fact
 * sheets. `inclination` is in degrees relative to the parent's equatorial plane;
 * `initialAngle` is the (deterministic) starting phase so co-orbital moons don't
 * stack. `retrograde` reverses the orbital direction (Triton).
 *
 * Tier 3 moonlets (radius < 50 km — Jupiter's ~91 irregulars, Saturn's ~100+)
 * are NOT simulated; they're decorative belt instances handled in the renderer.
 */
export interface MoonData {
  name: string;
  parentName: string;
  mass: number; // kg
  radius: number; // m
  semiMajorAxis: number; // m
  eccentricity: number;
  inclination: number; // degrees (relative to parent equator)
  initialAngle: number; // degrees (starting phase)
  retrograde?: boolean;
  tier: 1 | 2;
}

export const MOONS: readonly MoonData[] = [
  // --- Earth ---
  { name: "Moon", parentName: "Earth", mass: 7.342e22, radius: 1.737e6, semiMajorAxis: 3.844e8, eccentricity: 0.055, inclination: 5.1, initialAngle: 0, tier: 1 },

  // --- Mars ---
  { name: "Phobos", parentName: "Mars", mass: 1.066e16, radius: 1.13e4, semiMajorAxis: 9.376e6, eccentricity: 0.015, inclination: 1.1, initialAngle: 30, tier: 2 },
  { name: "Deimos", parentName: "Mars", mass: 1.476e15, radius: 6.2e3, semiMajorAxis: 2.346e7, eccentricity: 0.0002, inclination: 1.8, initialAngle: 200, tier: 2 },

  // --- Jupiter (Galilean — Tier 1) ---
  { name: "Io", parentName: "Jupiter", mass: 8.932e22, radius: 1.822e6, semiMajorAxis: 4.218e8, eccentricity: 0.004, inclination: 0.04, initialAngle: 0, tier: 1 },
  { name: "Europa", parentName: "Jupiter", mass: 4.8e22, radius: 1.561e6, semiMajorAxis: 6.711e8, eccentricity: 0.009, inclination: 0.47, initialAngle: 90, tier: 1 },
  { name: "Ganymede", parentName: "Jupiter", mass: 1.482e23, radius: 2.634e6, semiMajorAxis: 1.07e9, eccentricity: 0.001, inclination: 0.2, initialAngle: 180, tier: 1 },
  { name: "Callisto", parentName: "Jupiter", mass: 1.076e23, radius: 2.41e6, semiMajorAxis: 1.883e9, eccentricity: 0.007, inclination: 0.19, initialAngle: 270, tier: 1 },
  // --- Jupiter (Tier 2 — inner + irregular) ---
  { name: "Amalthea", parentName: "Jupiter", mass: 2.08e18, radius: 8.35e4, semiMajorAxis: 1.814e8, eccentricity: 0.003, inclination: 0.37, initialAngle: 45, tier: 2 },
  { name: "Thebe", parentName: "Jupiter", mass: 7.77e17, radius: 4.9e4, semiMajorAxis: 2.219e8, eccentricity: 0.018, inclination: 1.08, initialAngle: 220, tier: 2 },
  { name: "Himalia", parentName: "Jupiter", mass: 6.7e18, radius: 6.9e4, semiMajorAxis: 1.143e10, eccentricity: 0.162, inclination: 27.5, initialAngle: 120, tier: 2 },
  { name: "Elara", parentName: "Jupiter", mass: 8.7e17, radius: 4.3e4, semiMajorAxis: 1.172e10, eccentricity: 0.217, inclination: 26.6, initialAngle: 300, tier: 2 },

  // --- Saturn (Tier 1) ---
  { name: "Mimas", parentName: "Saturn", mass: 3.75e19, radius: 1.982e5, semiMajorAxis: 1.855e8, eccentricity: 0.02, inclination: 1.57, initialAngle: 10, tier: 1 },
  { name: "Enceladus", parentName: "Saturn", mass: 1.08e20, radius: 2.52e5, semiMajorAxis: 2.38e8, eccentricity: 0.005, inclination: 0.009, initialAngle: 55, tier: 1 },
  { name: "Tethys", parentName: "Saturn", mass: 6.175e20, radius: 5.33e5, semiMajorAxis: 2.947e8, eccentricity: 0.001, inclination: 1.09, initialAngle: 100, tier: 1 },
  { name: "Dione", parentName: "Saturn", mass: 1.096e21, radius: 5.615e5, semiMajorAxis: 3.774e8, eccentricity: 0.002, inclination: 0.019, initialAngle: 145, tier: 1 },
  { name: "Rhea", parentName: "Saturn", mass: 2.307e21, radius: 7.638e5, semiMajorAxis: 5.27e8, eccentricity: 0.001, inclination: 0.345, initialAngle: 200, tier: 1 },
  { name: "Titan", parentName: "Saturn", mass: 1.345e23, radius: 2.576e6, semiMajorAxis: 1.222e9, eccentricity: 0.029, inclination: 0.33, initialAngle: 250, tier: 1 },
  { name: "Hyperion", parentName: "Saturn", mass: 5.62e18, radius: 1.35e5, semiMajorAxis: 1.481e9, eccentricity: 0.123, inclination: 0.43, initialAngle: 340, tier: 1 },
  { name: "Iapetus", parentName: "Saturn", mass: 1.806e21, radius: 7.345e5, semiMajorAxis: 3.561e9, eccentricity: 0.029, inclination: 15.5, initialAngle: 310, tier: 1 },
  // --- Saturn (Tier 2) ---
  { name: "Phoebe", parentName: "Saturn", mass: 8.29e18, radius: 1.065e5, semiMajorAxis: 1.295e10, eccentricity: 0.156, inclination: 175.3, initialAngle: 80, tier: 2 },
  { name: "Helene", parentName: "Saturn", mass: 2.5e15, radius: 1.79e4, semiMajorAxis: 3.774e8, eccentricity: 0.007, inclination: 0.2, initialAngle: 160, tier: 2 },
  { name: "Telesto", parentName: "Saturn", mass: 7.2e15, radius: 1.245e4, semiMajorAxis: 2.947e8, eccentricity: 0.001, inclination: 1.18, initialAngle: 280, tier: 2 },

  // --- Uranus (Tier 1) ---
  { name: "Miranda", parentName: "Uranus", mass: 6.59e19, radius: 2.359e5, semiMajorAxis: 1.299e8, eccentricity: 0.001, inclination: 4.34, initialAngle: 20, tier: 1 },
  { name: "Ariel", parentName: "Uranus", mass: 1.353e21, radius: 5.789e5, semiMajorAxis: 1.909e8, eccentricity: 0.001, inclination: 0.04, initialAngle: 80, tier: 1 },
  { name: "Umbriel", parentName: "Uranus", mass: 1.275e21, radius: 5.847e5, semiMajorAxis: 2.66e8, eccentricity: 0.004, inclination: 0.13, initialAngle: 140, tier: 1 },
  { name: "Titania", parentName: "Uranus", mass: 3.527e21, radius: 7.889e5, semiMajorAxis: 4.363e8, eccentricity: 0.001, inclination: 0.34, initialAngle: 210, tier: 1 },
  { name: "Oberon", parentName: "Uranus", mass: 3.014e21, radius: 7.614e5, semiMajorAxis: 5.835e8, eccentricity: 0.001, inclination: 0.07, initialAngle: 290, tier: 1 },

  // --- Neptune (Tier 1) ---
  { name: "Proteus", parentName: "Neptune", mass: 4.4e19, radius: 2.1e5, semiMajorAxis: 1.176e8, eccentricity: 0.0, inclination: 0.075, initialAngle: 250, tier: 1 },
  { name: "Triton", parentName: "Neptune", mass: 2.139e22, radius: 1.353e6, semiMajorAxis: 3.548e8, eccentricity: 0.0, inclination: 20, initialAngle: 0, retrograde: true, tier: 1 },
  { name: "Nereid", parentName: "Neptune", mass: 3.1e19, radius: 1.7e5, semiMajorAxis: 5.514e9, eccentricity: 0.751, inclination: 7.23, initialAngle: 130, tier: 1 },
];
