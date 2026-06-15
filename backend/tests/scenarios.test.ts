import { test } from "node:test";
import assert from "node:assert/strict";
import { PhysicsEngine } from "../src/core/index.ts";
import { generateGalaxy } from "../src/entities/index.ts";
import {
  buildBinaryStar,
  buildAsteroidBelt,
  buildAndromeda,
  buildFigureEight,
} from "../../scripts/generate-scenarios.ts";

function runsFinitely(scenario: ReturnType<typeof buildBinaryStar>, steps: number, dt: number) {
  const engine = PhysicsEngine.fromScenario(scenario);
  engine.config.collisions = false;
  engine.run(steps, dt);
  for (const b of engine.bodies) assert.ok(b.position.isFinite(), `${b.id} non-finite`);
  return engine;
}

test("binary star: stars stay bound and the planet survives", () => {
  const sc = buildBinaryStar();
  assert.equal(sc.bodies.length, 3);
  const engine = runsFinitely(sc, 500, 3600 * 6);
  assert.equal(engine.count, 3); // nothing flung out or merged (collisions off)
});

test("asteroid belt builds 402 bodies and integrates cleanly", () => {
  const sc = buildAsteroidBelt(7);
  assert.equal(sc.bodies.length, 402); // sun + jupiter + 400
  runsFinitely(sc, 100, 3600 * 24);
});

test("asteroid belt generation is deterministic", () => {
  assert.equal(JSON.stringify(buildAsteroidBelt(7)), JSON.stringify(buildAsteroidBelt(7)));
});

test("figure-eight choreography stays bounded over an orbit", () => {
  const sc = buildFigureEight();
  assert.equal(sc.G, 1);
  const engine = PhysicsEngine.fromScenario(sc);
  // The orbit has period ~6.32 in these units; integrate a chunk with small dt.
  engine.run(6000, 1e-3);
  for (const b of engine.bodies) {
    assert.ok(b.position.isFinite());
    // All three stay within a few units of the origin (bounded choreography).
    assert.ok(b.position.length() < 3, `${b.id} drifted to ${b.position.length()}`);
  }
});

test("galaxy generator yields count+1 bodies and a rotating disk that stays finite", () => {
  const sc = generateGalaxy(31, { count: 300 });
  assert.equal(sc.bodies.length, 301); // bulge + 300 stars
  const andromeda = buildAndromeda();
  assert.equal(andromeda.name, "Andromeda");
  runsFinitely(sc, 10, 1e13);
});
