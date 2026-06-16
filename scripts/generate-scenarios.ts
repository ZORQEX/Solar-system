/**
 * World generators: write several ready-to-run scenarios into `data/`.
 * Run with:  node scripts/generate-scenarios.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { Rng, generateGalaxy } from "../backend/src/entities/index.ts";
import { buildSolarSystem } from "./generate-solar-system.ts";
import { MOONS, type MoonData } from "./data/moons.ts";
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

/**
 * Initial SI state vector for a moon on a circular (optionally inclined,
 * optionally retrograde) orbit about its parent. Everything is in metres /
 * m·s⁻¹ — the same SI frame as the planets — and added to the parent's own
 * state so the moon co-moves with the planet around the Sun.
 *
 * Note: the scenario data is SI (not AU); the frontend divides by AU only at
 * render time. We use the circular speed at the semi-major axis; eccentricity
 * is carried for reference but not applied to the initial velocity.
 */
function moonInitialState(
  moon: MoonData,
  parent: BodyData,
): { position: BodyData["position"]; velocity: BodyData["velocity"] } {
  const angle = (moon.initialAngle * Math.PI) / 180;
  const inc = (moon.inclination * Math.PI) / 180;
  const a = moon.semiMajorAxis; // metres
  const v = Math.sqrt((G * parent.mass) / a); // circular speed (m/s)
  const dir = moon.retrograde ? -1 : 1;

  // Circular orbit in the parent's equatorial (x–z) plane…
  let px = a * Math.cos(angle);
  let py = 0;
  let pz = a * Math.sin(angle);
  let vx = -dir * v * Math.sin(angle);
  let vy = 0;
  let vz = dir * v * Math.cos(angle);

  // …tilted by the orbital inclination about the x-axis (rotate the y–z plane),
  // so it stays a proper closed orbit, just inclined.
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  [py, pz] = [py * ci - pz * si, py * si + pz * ci];
  [vy, vz] = [vy * ci - vz * si, vy * si + vz * ci];

  return {
    position: {
      x: parent.position.x + px,
      y: parent.position.y + py,
      z: parent.position.z + pz,
    },
    velocity: {
      x: parent.velocity.x + vx,
      y: parent.velocity.y + vy,
      z: parent.velocity.z + vz,
    },
  };
}

/** Sun + planets (from generate-solar-system) + all Tier 1+2 moons. */
export function buildSolarSystemWithMoons(): ScenarioData {
  const base = buildSolarSystem();
  const byName = new Map(base.bodies.map((b) => [(b.name ?? b.id).toLowerCase(), b]));

  const moons: BodyData[] = [];
  for (const m of MOONS) {
    const parent = byName.get(m.parentName.toLowerCase());
    if (!parent) continue;
    const { position, velocity } = moonInitialState(m, parent);
    moons.push({
      id: m.name.toLowerCase(),
      name: m.name,
      type: "moon",
      mass: m.mass,
      radius: m.radius,
      position,
      velocity,
      parentId: parent.id,
      color: "#9aa0a6",
    });
  }

  return {
    name: "Solar System",
    description: `Sun, planets and ${moons.length} major moons (NASA/JPL data).`,
    softening: 1e6, // small enough for close moons (Phobos at 9.4e6 m) to orbit
    bodies: [...base.bodies, ...moons],
  };
}

const SCENARIOS: Record<string, () => ScenarioData> = {
  "solar-system": buildSolarSystemWithMoons,
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
