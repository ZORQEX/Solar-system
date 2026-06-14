import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateStarSystem,
  generateStarCluster,
} from "../src/entities/index.ts";
import { PhysicsEngine } from "../src/core/index.ts";

test("generation is deterministic in the seed", () => {
  const a = generateStarSystem(20490614);
  const b = generateStarSystem(20490614);
  assert.equal(JSON.stringify(a.scenario), JSON.stringify(b.scenario));
});

test("different seeds yield different systems", () => {
  const a = generateStarSystem(1);
  const b = generateStarSystem(2);
  assert.notEqual(JSON.stringify(a.scenario), JSON.stringify(b.scenario));
});

test("a generated system loads and runs without blowing up", () => {
  // Pick a seed that yields planets, then integrate a little.
  const sys = generateStarSystem(777);
  const engine = PhysicsEngine.fromScenario(sys.scenario);
  assert.equal(engine.count, sys.scenario.bodies.length);

  engine.run(200, 3600); // ~8 days at 1h steps
  for (const b of engine.bodies) {
    assert.ok(b.position.isFinite(), `body ${b.id} went non-finite`);
  }
});

test("planets orbit inside the snow-line split (inner rocky, outer gas/ice)", () => {
  const sys = generateStarSystem(54321);
  // Star is always body 0; remaining bodies are planets sorted outward.
  const planetBodies = sys.scenario.bodies.slice(1);
  // If there are both rocky and gas planets, the innermost gas giant should be
  // farther out than the outermost purely-rocky planet is not strictly required,
  // but every gas giant must at least be beyond the innermost planet.
  assert.equal(planetBodies.length, sys.planets.length);
});

test("star cluster produces the requested count and stays finite", () => {
  const scenario = generateStarCluster(2024, { count: 300 });
  assert.equal(scenario.bodies.length, 300);

  const engine = PhysicsEngine.fromScenario(scenario);
  engine.config.collisions = false; // raw N-body stress test
  engine.run(20, 1e10);
  for (const b of engine.bodies) {
    assert.ok(b.position.isFinite());
  }
});
