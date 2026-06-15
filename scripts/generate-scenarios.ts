/**
 * World generators: write several ready-to-run scenarios into `data/`.
 * Run with:  node scripts/generate-scenarios.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { Rng, generateGalaxy } from "../backend/src/entities/index.ts";
import {
  AU,
  G,
  SOLAR_MASS,
  SOLAR_RADIUS,
} from "../shared/src/constants.ts";
import type { BodyData, ScenarioData } from "../shared/src/types.ts";

/** Two equal-mass stars on a mutual circular orbit with a circumbinary planet. */
export function buildBinaryStar(): ScenarioData {
  const m = SOLAR_MASS;
  const d = 0.2 * AU; // separation
  const v = Math.sqrt((G * m) / (2 * d)); // each star's speed about the barycenter

  const planetA = 3 * AU;
  const vp = Math.sqrt((G * 2 * m) / planetA); // circular about the pair

  const bodies: BodyData[] = [
    { id: "star-a", name: "Alpha", type: "star", mass: m, radius: SOLAR_RADIUS, position: { x: d / 2, y: 0, z: 0 }, velocity: { x: 0, y: v, z: 0 }, color: "#ffd76a" },
    { id: "star-b", name: "Beta", type: "star", mass: m, radius: SOLAR_RADIUS, position: { x: -d / 2, y: 0, z: 0 }, velocity: { x: 0, y: -v, z: 0 }, color: "#ffb56c" },
    { id: "planet", name: "Circe", type: "planet", mass: 5.97e24, radius: 6.37e6, position: { x: planetA, y: 0, z: 0 }, velocity: { x: 0, y: vp, z: 0 }, color: "#2e6fdb" },
  ];
  return { name: "Binary Star", description: "Two suns and a circumbinary planet.", softening: 1e8, bodies };
}

/** A star with Jupiter shepherding a belt of small bodies between 2.2–3.3 AU. */
export function buildAsteroidBelt(seed = 7): ScenarioData {
  const rng = new Rng(seed);
  const M = SOLAR_MASS;
  const bodies: BodyData[] = [
    { id: "sun", name: "Sun", type: "star", mass: M, radius: SOLAR_RADIUS, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, color: "#ffd76a" },
  ];

  const jA = 5.2 * AU;
  const jv = Math.sqrt((G * M) / jA);
  bodies.push({ id: "jupiter", name: "Jupiter", type: "gas-giant", mass: 1.898e27, radius: 6.99e7, position: { x: jA, y: 0, z: 0 }, velocity: { x: 0, y: jv, z: 0 }, color: "#c9a87c" });

  for (let i = 0; i < 400; i++) {
    const a = AU * rng.range(2.2, 3.3);
    const theta = rng.range(0, 2 * Math.PI);
    const z = rng.gaussian(0, 0.02 * AU);
    const v = Math.sqrt((G * M) / a) * (1 + rng.gaussian(0, 0.02));
    bodies.push({
      id: `asteroid-${i}`,
      type: "asteroid",
      mass: Math.pow(10, rng.range(15, 21)),
      radius: rng.range(1e3, 5e5),
      position: { x: a * Math.cos(theta), y: a * Math.sin(theta), z },
      velocity: { x: -v * Math.sin(theta), y: v * Math.cos(theta), z: 0 },
      color: "#9c8e7e",
    });
  }
  return { name: "Asteroid Belt", description: "Sun + Jupiter + a 400-body belt.", softening: 1e8, bodies };
}

/** Andromeda-like disk galaxy. */
export function buildAndromeda(): ScenarioData {
  return { ...generateGalaxy(31, { count: 800 }), name: "Andromeda", description: "A disk galaxy of 800 stars around a massive bulge." };
}

/**
 * The Chenciner–Montgomery figure-eight: three equal masses chasing each other
 * along a single ∞-shaped orbit. Natural units (G = 1).
 */
export function buildFigureEight(): ScenarioData {
  const bodies: BodyData[] = [
    { id: "a", name: "A", type: "star", mass: 1, radius: 0.02, position: { x: 0.97000436, y: -0.24308753, z: 0 }, velocity: { x: 0.466203685, y: 0.43236573, z: 0 }, color: "#ff6a6a" },
    { id: "b", name: "B", type: "star", mass: 1, radius: 0.02, position: { x: -0.97000436, y: 0.24308753, z: 0 }, velocity: { x: 0.466203685, y: 0.43236573, z: 0 }, color: "#6aff8c" },
    { id: "c", name: "C", type: "star", mass: 1, radius: 0.02, position: { x: 0, y: 0, z: 0 }, velocity: { x: -0.93240737, y: -0.86473146, z: 0 }, color: "#6a9cff" },
  ];
  return { name: "Figure-Eight (3-body)", description: "A stable three-body choreography (G=1).", G: 1, softening: 0, bodies };
}

const SCENARIOS: Record<string, () => ScenarioData> = {
  "binary-star": buildBinaryStar,
  "asteroid-belt": buildAsteroidBelt,
  andromeda: buildAndromeda,
  "figure-eight": buildFigureEight,
};

function writeAll(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(here, "..", "data");
  mkdirSync(dataDir, { recursive: true });
  for (const [name, build] of Object.entries(SCENARIOS)) {
    const path = join(dataDir, `${name}.json`);
    writeFileSync(path, JSON.stringify(build(), null, 2) + "\n");
    console.log(`Wrote ${path}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeAll();
}
