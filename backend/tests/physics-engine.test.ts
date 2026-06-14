import { test } from "node:test";
import assert from "node:assert/strict";
import { Body } from "../src/core/body.ts";
import { Vector3 } from "../src/core/vector3.ts";
import { PhysicsEngine } from "../src/core/physics-engine.ts";
import type { ScenarioData } from "../src/shared.ts";

test("fromScenario loads bodies and per-scenario config", () => {
  const scenario: ScenarioData = {
    name: "pair",
    G: 1,
    softening: 0.01,
    bodies: [
      { id: "a", type: "star", mass: 10, radius: 0.1, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
      { id: "b", type: "planet", mass: 1, radius: 0.05, position: { x: 5, y: 0, z: 0 }, velocity: { x: 0, y: 1, z: 0 } },
    ],
  };

  const engine = PhysicsEngine.fromScenario(scenario);
  assert.equal(engine.count, 2);
  assert.equal(engine.config.G, 1);
  assert.equal(engine.config.softening, 0.01);

  const snap = engine.snapshot();
  assert.equal(snap.length, 2);
  assert.equal(snap[0]!.id, "a");
});

test("engine merges overlapping bodies during a step and conserves mass", () => {
  const bodies = [
    new Body({ id: "a", mass: 4, radius: 1, position: new Vector3(0, 0, 0), velocity: new Vector3(1, 0, 0) }),
    new Body({ id: "b", mass: 6, radius: 1, position: new Vector3(0.5, 0, 0), velocity: new Vector3(-1, 0, 0) }),
  ];
  const engine = new PhysicsEngine(bodies, { G: 1, softening: 0.1 });

  const massBefore = engine.totalMass();
  const pBefore = engine.totalMomentum();

  engine.step(1e-3);

  assert.equal(engine.count, 1);
  assert.ok(Math.abs(engine.totalMass() - massBefore) < 1e-9);
  // Momentum is conserved across the merge (gravity over one tiny step is negligible).
  assert.ok(engine.totalMomentum().sub(pBefore).length() < 1e-2);
});

test("time and step counters advance", () => {
  const engine = new PhysicsEngine(
    [new Body({ id: "solo", mass: 1, radius: 0, position: new Vector3(0, 0, 0) })],
    { G: 1 },
  );
  engine.run(10, 0.5);
  assert.equal(engine.steps, 10);
  assert.ok(Math.abs(engine.time - 5) < 1e-12);
});

test("a lone body drifts at constant velocity (no self-force)", () => {
  const engine = new PhysicsEngine(
    [new Body({ id: "solo", mass: 1, radius: 0, position: new Vector3(0, 0, 0), velocity: new Vector3(2, 0, 0) })],
    { G: 1, collisions: false },
  );
  engine.run(100, 0.01); // t = 1
  const p = engine.bodies[0]!.position;
  assert.ok(Math.abs(p.x - 2) < 1e-9, `expected x≈2, got ${p.x}`);
  assert.ok(Math.abs(p.y) < 1e-12 && Math.abs(p.z) < 1e-12);
});
