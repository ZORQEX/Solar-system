/**
 * Demo: load the generated solar system, simulate one Earth year, and report
 * orbit stability + energy conservation.  Run with:  npm run demo
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PhysicsEngine } from "../backend/src/core/index.ts";
import { SECONDS_PER_YEAR, AU } from "../shared/src/constants.ts";
import type { ScenarioData } from "../shared/src/types.ts";
import { buildSolarSystem } from "./generate-solar-system.ts";

function loadScenario(): ScenarioData {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "data", "solar-system.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ScenarioData;
  } catch {
    // Fall back to building it on the fly if the data file isn't generated yet.
    console.log("(data/solar-system.json not found — building in memory)");
    return buildSolarSystem();
  }
}

const engine = PhysicsEngine.fromScenario(loadScenario());
console.log(`Loaded ${engine.bodies.length} bodies  ·  collisions on\n`);

const earth = engine.bodies.find((b) => b.id === "earth")!;
const sun = engine.bodies.find((b) => b.id === "sun")!;

const dt = 3600; // 1 hour
const steps = Math.round(SECONDS_PER_YEAR / dt); // ~1 Earth year
const e0 = engine.energy().total;

let minR = Infinity;
let maxR = -Infinity;
const sampleEvery = Math.floor(steps / 12);

console.log("  month   Earth–Sun (AU)");
for (let i = 1; i <= steps; i++) {
  engine.step(dt);
  const r = earth.position.distance(sun.position);
  minR = Math.min(minR, r);
  maxR = Math.max(maxR, r);
  if (i % sampleEvery === 0) {
    const month = ((i * dt) / SECONDS_PER_YEAR) * 12;
    console.log(`  ${month.toFixed(1).padStart(5)}   ${(r / AU).toFixed(6)}`);
  }
}

const e1 = engine.energy().total;
const drift = Math.abs((e1 - e0) / e0);

console.log("\n--- summary ---");
console.log(`steps simulated : ${engine.steps}  (dt = ${dt}s)`);
console.log(`sim time        : ${(engine.time / SECONDS_PER_YEAR).toFixed(3)} years`);
console.log(`Earth orbit     : ${(minR / AU).toFixed(4)}–${(maxR / AU).toFixed(4)} AU`);
console.log(`energy drift    : ${(drift * 100).toExponential(2)} %`);
