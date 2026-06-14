import { test } from "node:test";
import assert from "node:assert/strict";
import { Body } from "../src/core/body.ts";
import { Vector3 } from "../src/core/vector3.ts";
import { PhysicsEngine } from "../src/core/physics-engine.ts";

/**
 * Two-body system in natural units (G = 1): a heavy central mass and a light
 * orbiter on a circular orbit of radius r with v = √(G·M/r).
 */
function twoBody(): { engine: PhysicsEngine; r: number } {
  const G = 1;
  const M = 1e8; // central mass — effectively fixed
  const r = 1;
  const v = Math.sqrt((G * M) / r); // circular speed

  const central = new Body({
    id: "sun",
    mass: M,
    radius: 0,
    position: new Vector3(0, 0, 0),
  });
  const orbiter = new Body({
    id: "planet",
    mass: 1,
    radius: 0,
    position: new Vector3(r, 0, 0),
    velocity: new Vector3(0, v, 0),
  });

  const engine = new PhysicsEngine([central, orbiter], {
    G,
    theta: 0,
    softening: 0,
    collisions: false,
  });
  return { engine, r };
}

test("circular orbit stays bounded near its initial radius", () => {
  const { engine, r } = twoBody();
  const orbiter = engine.bodies[1]!;
  const central = engine.bodies[0]!;

  const period = (2 * Math.PI * r) / Math.sqrt(1e8); // 2πr / v
  const steps = 4000;
  const dt = period / steps;

  let minSep = Infinity;
  let maxSep = -Infinity;
  for (let i = 0; i < steps; i++) {
    engine.step(dt);
    const sep = orbiter.position.distance(central.position);
    minSep = Math.min(minSep, sep);
    maxSep = Math.max(maxSep, sep);
  }

  // Should trace a circle: separation stays within ~1% of r the whole orbit.
  assert.ok(maxSep < r * 1.01, `maxSep ${maxSep} should stay < ${r * 1.01}`);
  assert.ok(minSep > r * 0.99, `minSep ${minSep} should stay > ${r * 0.99}`);
});

test("velocity-verlet keeps total energy bounded over many orbits", () => {
  const { engine } = twoBody();
  const period = (2 * Math.PI) / Math.sqrt(1e8);
  const dt = period / 1000;

  const e0 = engine.energy().total;
  engine.run(5000, dt); // ~5 orbits
  const e1 = engine.energy().total;

  const drift = Math.abs((e1 - e0) / e0);
  assert.ok(drift < 5e-3, `relative energy drift ${drift} should be < 0.005`);
});

test("exact gravity (theta = 0) conserves total momentum", () => {
  // Three mutually interacting bodies, no net external force.
  const bodies = [
    new Body({ id: "a", mass: 3, radius: 0, position: new Vector3(-2, 0, 0), velocity: new Vector3(0, -1, 0) }),
    new Body({ id: "b", mass: 4, radius: 0, position: new Vector3(2, 0, 0), velocity: new Vector3(0, 1, 0.5) }),
    new Body({ id: "c", mass: 5, radius: 0, position: new Vector3(0, 3, 0), velocity: new Vector3(1, 0, -0.5) }),
  ];
  const engine = new PhysicsEngine(bodies, {
    G: 1,
    theta: 0,
    softening: 0.1,
    collisions: false,
  });

  const p0 = engine.totalMomentum();
  engine.run(2000, 1e-3);
  const p1 = engine.totalMomentum();

  assert.ok(
    p1.sub(p0).length() < 1e-6,
    `momentum changed by ${p1.sub(p0).length()} (should be ~0)`,
  );
});
