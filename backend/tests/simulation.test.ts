import { test } from "node:test";
import assert from "node:assert/strict";
import { Body, PhysicsEngine, Vector3 } from "../src/core/index.ts";
import { Star } from "../src/entities/index.ts";
import { Simulation, World } from "../src/simulation/index.ts";
import { SECONDS_PER_YEAR, SOLAR_MASS } from "../src/shared.ts";

test("simulate advances simulated time by exactly the requested span", () => {
  const sim = Simulation.fromSeed(101);
  sim.simulate(12345);
  assert.equal(sim.timeSeconds, 12345);
  sim.simulate(54321);
  assert.equal(sim.timeSeconds, 12345 + 54321);
});

test("simulation is deterministic for a fixed seed", () => {
  const a = Simulation.fromSeed(424242);
  const b = Simulation.fromSeed(424242);
  a.simulate(1e7);
  b.simulate(1e7);
  assert.equal(
    JSON.stringify(a.world.physics.snapshot()),
    JSON.stringify(b.world.physics.snapshot()),
  );
});

test("very long spans are capped to maxSubsteps but still cover the full span", () => {
  const sim = Simulation.fromSeed(5, { fixedDt: 3600, maxSubstepsPerStep: 64 });
  const span = 3600 * 64 * 100; // 100x more than the cap allows at fixedDt
  const report = sim.simulate(span);
  assert.equal(report.steps, 64);
  assert.ok(report.dt > 3600, "step size stretched to cover the span");
  assert.equal(sim.timeSeconds, span); // entity clock never desyncs
});

test("the simulation layer preserves energy conservation for a clean orbit", () => {
  const M = 1e8;
  const r = 1;
  const v = Math.sqrt(M / r);
  const central = new Body({ id: "sun", mass: M, radius: 0, position: new Vector3(0, 0, 0) });
  const orbiter = new Body({ id: "p", mass: 1, radius: 0, position: new Vector3(r, 0, 0), velocity: new Vector3(0, v, 0) });
  const engine = new PhysicsEngine([central, orbiter], { G: 1, theta: 0, softening: 0, collisions: false });
  const sim = new Simulation(new World(engine), { fixedDt: (2 * Math.PI) / Math.sqrt(M) / 1000, maxSubstepsPerStep: 100000 });

  const period = (2 * Math.PI * r) / v;
  const e0 = engine.energy().total;
  sim.simulate(5 * period);
  const e1 = engine.energy().total;
  assert.ok(Math.abs((e1 - e0) / e0) < 5e-3);
});

test("a dying star turns its body into a black hole", () => {
  const star = new Star({ id: "s", mass: 25 * SOLAR_MASS, ageYears: 0 });
  const body = new Body({ id: "s", type: "star", mass: 25 * SOLAR_MASS, radius: star.radiusMeters(), position: new Vector3(0, 0, 0) });
  const engine = new PhysicsEngine([body], { collisions: false });
  const world = new World(engine);
  world.registerStar(star);
  const sim = new Simulation(world, { fixedDt: SECONDS_PER_YEAR * 1e5, maxSubstepsPerStep: 10 });

  assert.equal(body.type, "star");
  sim.simulate(5e6 * SECONDS_PER_YEAR); // well past its ~3.2 Myr life
  assert.equal(star.stage(), "black-hole");
  assert.equal(body.type, "black-hole");
  assert.ok(Math.abs(body.radius - star.schwarzschildRadius()) < 1);
});

test("tick obeys the time scale and pause", () => {
  const sim = Simulation.fromSeed(9);
  sim.time.setScale(1000);
  sim.tick(2); // 2 real s -> 2000 sim s
  assert.equal(sim.timeSeconds, 2000);
  sim.time.pause();
  sim.tick(10);
  assert.equal(sim.timeSeconds, 2000); // frozen
});
