import { Rng } from "./random.ts";
import { Star } from "./star.ts";
import { Planet, type PlanetComposition } from "./planet.ts";
import { createBiosphere, type Biosphere } from "./life.ts";
import {
  AU,
  G,
  SOLAR_MASS,
  SOLAR_LUMINOSITY,
  EARTH_MASS,
  EARTH_RADIUS,
} from "../shared.ts";
import type { BodyData, ScenarioData } from "../shared.ts";

/** Display colour for a star, by spectral class (hot = blue, cool = red). */
function starColor(star: Star): string {
  const colors: Record<string, string> = {
    O: "#9bb0ff", B: "#aabfff", A: "#cad7ff", F: "#f8f7ff",
    G: "#fff4ea", K: "#ffd2a1", M: "#ffb56c", L: "#c95a3a",
  };
  if (star.stage() === "black-hole") return "#000000";
  if (star.stage() === "neutron-star") return "#e8f0ff";
  return colors[star.spectralClass()] ?? "#ffffff";
}

const COMPOSITION_COLOR: Record<PlanetComposition, string> = {
  rocky: "#9c8e7e",
  iron: "#7a6f63",
  ice: "#bfe7f0",
  gas: "#d8b48c",
  ocean: "#2e6fdb",
};

export interface StarSystem {
  scenario: ScenarioData;
  star: Star;
  planets: Planet[];
  biosphere: Biosphere | null;
}

export interface StarSystemOptions {
  /** Force a particular stellar mass (kg). Otherwise sampled from an IMF-ish law. */
  starMass?: number;
  /** Id prefix for generated bodies. */
  prefix?: string;
}

/**
 * Generate one star system from a seed: a star plus 0–8 planets on coplanar
 * circular orbits, with compositions split at the snow line and a biosphere
 * seeded on the most habitable world (if any). Fully deterministic in `seed`.
 */
export function generateStarSystem(
  seed: number,
  options: StarSystemOptions = {},
): StarSystem {
  const rng = new Rng(seed);
  const prefix = options.prefix ?? `sys${seed}`;

  // Stellar mass: log-biased toward low-mass stars (there are far more of them).
  const massSolar =
    options.starMass !== undefined
      ? options.starMass / SOLAR_MASS
      : 0.1 * Math.pow(80, rng.next() ** 2); // 0.1 – 8 M☉, biased low
  const star = new Star({
    id: `${prefix}-star`,
    name: `${prefix} A`,
    mass: massSolar * SOLAR_MASS,
    ageYears: rng.range(1e8, 5e9),
  });

  const luminosity = star.luminosityWatts();
  const lRel = luminosity / SOLAR_LUMINOSITY;
  const snowLineAU = 2.7 * Math.sqrt(Math.max(lRel, 1e-6));

  const bodies: BodyData[] = [
    {
      id: star.id,
      ...(star.name !== undefined ? { name: star.name } : {}),
      type: star.currentBodyType(),
      mass: star.initialMass,
      radius: star.radiusMeters(),
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: starColor(star),
    },
  ];

  const planetCount = rng.int(0, 8);
  const planets: Planet[] = [];
  let baseAU = rng.range(0.3, 0.7);

  for (let i = 0; i < planetCount; i++) {
    // Titius–Bode-like geometric spacing with jitter.
    const aAU = baseAU * rng.range(0.9, 1.1);
    baseAU *= rng.range(1.5, 2.0);
    const a = aAU * AU;

    const composition: PlanetComposition =
      aAU < snowLineAU
        ? rng.bool(0.85)
          ? "rocky"
          : "iron"
        : rng.bool(0.6)
          ? "gas"
          : "ice";

    let mass: number;
    let radius: number;
    switch (composition) {
      case "gas":
        mass = EARTH_MASS * rng.range(15, 1000);
        radius = 7e7 * rng.range(0.6, 1.4);
        break;
      case "ice":
        mass = EARTH_MASS * rng.range(5, 50);
        radius = EARTH_RADIUS * Math.pow(mass / EARTH_MASS, 0.4);
        break;
      case "iron":
        mass = EARTH_MASS * rng.range(0.1, 3);
        radius = EARTH_RADIUS * Math.pow(mass / EARTH_MASS, 0.25);
        break;
      case "rocky":
      default:
        mass = EARTH_MASS * rng.range(0.1, 5);
        radius = EARTH_RADIUS * Math.pow(mass / EARTH_MASS, 0.27);
        break;
    }

    const planet = new Planet({
      id: `${prefix}-p${i}`,
      name: `${prefix} ${i + 1}`,
      mass,
      radius,
      composition,
      semiMajorAxis: a,
    });
    planets.push(planet);

    // Circular orbit in the xy-plane at a random phase.
    const theta = rng.range(0, 2 * Math.PI);
    const v = Math.sqrt((G * star.initialMass) / a);
    bodies.push({
      id: planet.id,
      ...(planet.name !== undefined ? { name: planet.name } : {}),
      type: composition === "gas" ? "gas-giant" : "planet",
      mass,
      radius,
      position: { x: a * Math.cos(theta), y: a * Math.sin(theta), z: 0 },
      velocity: { x: -v * Math.sin(theta), y: v * Math.cos(theta), z: 0 },
      color: COMPOSITION_COLOR[composition],
    });
  }

  // Seed life on the most habitable world.
  let biosphere: Biosphere | null = null;
  let best: { planet: Planet; score: number } | null = null;
  for (const p of planets) {
    const score = p.habitabilityScore(luminosity);
    if (score > 0 && (best === null || score > best.score)) {
      best = { planet: p, score };
    }
  }
  if (best !== null && rng.bool(best.score)) {
    biosphere = createBiosphere(best.planet.id);
  }

  const scenario: ScenarioData = {
    name: `Star system ${prefix}`,
    description: `Procedurally generated ${star.spectralClass()}-class system (seed ${seed}).`,
    softening: 1e7,
    bodies,
  };

  return { scenario, star, planets, biosphere };
}

export interface StarClusterOptions {
  count: number;
  /** Cluster radius in metres. Defaults to ~1 parsec. */
  radius?: number;
}

/**
 * Scatter `count` stars uniformly through a sphere with small random velocities
 * — a ready-made many-body scenario for stress-testing the Barnes–Hut solver.
 */
export function generateStarCluster(
  seed: number,
  options: StarClusterOptions,
): ScenarioData {
  const rng = new Rng(seed);
  const radius = options.radius ?? 3.086e16; // ~1 pc
  const bodies: BodyData[] = [];

  // Rough virial velocity scale for the cluster.
  const totalMassEstimate = options.count * SOLAR_MASS;
  const vScale = Math.sqrt((G * totalMassEstimate) / radius);

  for (let i = 0; i < options.count; i++) {
    const massSolar = 0.1 * Math.pow(80, rng.next() ** 2);
    const star = new Star({ id: `c-star${i}`, mass: massSolar * SOLAR_MASS });

    // Uniform point in a sphere (rejection-free: cube-root radius).
    const u = rng.next();
    const r = radius * Math.cbrt(u);
    const costheta = rng.range(-1, 1);
    const sintheta = Math.sqrt(1 - costheta * costheta);
    const phi = rng.range(0, 2 * Math.PI);

    bodies.push({
      id: star.id,
      type: "star",
      mass: star.initialMass,
      radius: star.radiusMeters(),
      position: {
        x: r * sintheta * Math.cos(phi),
        y: r * sintheta * Math.sin(phi),
        z: r * costheta,
      },
      velocity: {
        x: rng.gaussian(0, vScale),
        y: rng.gaussian(0, vScale),
        z: rng.gaussian(0, vScale),
      },
      color: starColor(star),
    });
  }

  return {
    name: `Star cluster (${options.count} stars)`,
    description: `Procedurally generated cluster (seed ${seed}).`,
    softening: radius / 1000,
    bodies,
  };
}

export interface GalaxyOptions {
  count: number;
  /** Disk radius in metres. Defaults to ~30 kpc. */
  radius?: number;
  /** Central bulge mass in kg. Defaults to 1e10 solar masses. */
  bulgeMass?: number;
}

/**
 * A rotating, flattened disk galaxy: a massive central bulge with stars on
 * near-circular orbits in a thin disk (rotation set by the enclosed bulge mass).
 * A coarse but recognisable "Andromeda" — and a good large-N scenario.
 */
export function generateGalaxy(seed: number, options: GalaxyOptions): ScenarioData {
  const rng = new Rng(seed);
  const radius = options.radius ?? 9.26e20; // ~30 kpc
  const bulgeMass = options.bulgeMass ?? 1e10 * SOLAR_MASS;
  const bodies: BodyData[] = [
    {
      id: "bulge",
      name: "Galactic bulge",
      type: "black-hole",
      mass: bulgeMass,
      radius: radius * 0.02,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: "#ffe8b0",
    },
  ];

  for (let i = 0; i < options.count; i++) {
    const massSolar = 0.1 * Math.pow(80, rng.next() ** 2);
    const star = new Star({ id: `g-star${i}`, mass: massSolar * SOLAR_MASS });

    // Thin disk: areal-uniform radius, random angle, small vertical scatter.
    const r = radius * (0.04 + 0.96 * Math.sqrt(rng.next()));
    const theta = rng.range(0, 2 * Math.PI);
    const z = rng.gaussian(0, radius * 0.02);
    const v = Math.sqrt((G * bulgeMass) / r); // circular about the bulge

    bodies.push({
      id: star.id,
      type: "star",
      mass: star.initialMass,
      radius: star.radiusMeters(),
      position: { x: r * Math.cos(theta), y: r * Math.sin(theta), z },
      velocity: { x: -v * Math.sin(theta), y: v * Math.cos(theta), z: 0 },
      color: starColor(star),
    });
  }

  return {
    name: `Galaxy (${options.count} stars)`,
    description: `Procedurally generated disk galaxy (seed ${seed}).`,
    softening: radius / 2000,
    bodies,
  };
}
