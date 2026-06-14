/**
 * World generator: writes `data/solar-system.json`.
 *
 * Each planet is placed on the +x axis at its semi-major axis and given the
 * circular orbital speed v = √(G·M_sun / a) along +y, producing coplanar,
 * near-circular orbits. Run with:  node scripts/generate-solar-system.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  G,
  SOLAR_MASS,
  SOLAR_RADIUS,
} from "../shared/src/constants.ts";
import type { BodyData, ScenarioData } from "../shared/src/types.ts";

const MU_SUN = G * SOLAR_MASS; // standard gravitational parameter

interface PlanetSpec {
  id: string;
  name: string;
  type: BodyData["type"];
  mass: number; // kg
  radius: number; // m
  a: number; // semi-major axis, m
  color: string;
}

const PLANETS: PlanetSpec[] = [
  { id: "mercury", name: "Mercury", type: "planet", mass: 3.3011e23, radius: 2.4397e6, a: 5.791e10, color: "#9c8e7e" },
  { id: "venus", name: "Venus", type: "planet", mass: 4.8675e24, radius: 6.0518e6, a: 1.0821e11, color: "#d9b38c" },
  { id: "earth", name: "Earth", type: "planet", mass: 5.9722e24, radius: 6.371e6, a: 1.495978707e11, color: "#2e6fdb" },
  { id: "mars", name: "Mars", type: "planet", mass: 6.4171e23, radius: 3.3895e6, a: 2.2792e11, color: "#c1440e" },
  { id: "jupiter", name: "Jupiter", type: "gas-giant", mass: 1.8982e27, radius: 6.9911e7, a: 7.7857e11, color: "#c9a87c" },
  { id: "saturn", name: "Saturn", type: "gas-giant", mass: 5.6834e26, radius: 5.8232e7, a: 1.43353e12, color: "#e3d6a8" },
  { id: "uranus", name: "Uranus", type: "gas-giant", mass: 8.681e25, radius: 2.5362e7, a: 2.87246e12, color: "#9fd6e0" },
  { id: "neptune", name: "Neptune", type: "gas-giant", mass: 1.02413e26, radius: 2.4622e7, a: 4.49506e12, color: "#3b6fd6" },
];

function buildSolarSystem(): ScenarioData {
  const bodies: BodyData[] = [
    {
      id: "sun",
      name: "Sun",
      type: "star",
      mass: SOLAR_MASS,
      radius: SOLAR_RADIUS,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: "#ffd76a",
    },
  ];

  for (const p of PLANETS) {
    const v = Math.sqrt(MU_SUN / p.a); // circular speed
    bodies.push({
      id: p.id,
      name: p.name,
      type: p.type,
      mass: p.mass,
      radius: p.radius,
      position: { x: p.a, y: 0, z: 0 },
      velocity: { x: 0, y: v, z: 0 },
      color: p.color,
    });
  }

  return {
    name: "Solar System",
    description:
      "The Sun and eight planets on coplanar circular orbits (SI units).",
    softening: 1e7,
    bodies,
  };
}

function writeScenario(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(here, "..", "data");
  mkdirSync(dataDir, { recursive: true });
  const outPath = join(dataDir, "solar-system.json");
  writeFileSync(outPath, JSON.stringify(buildSolarSystem(), null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}

// Only write the file when run directly, not when imported by the demo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeScenario();
}

export { buildSolarSystem };
