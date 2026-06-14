import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, World, type WorldSave } from "../src/simulation/index.ts";

test("a world survives a save → JSON → load round-trip", () => {
  const sim = Simulation.fromSeed(31337);
  sim.simulate(2e6);

  const save = sim.world.toSave();
  // Force it through an actual serialization boundary.
  const wire = JSON.parse(JSON.stringify(save)) as WorldSave;
  const restored = World.fromSave(wire);

  assert.equal(restored.name, sim.world.name);
  assert.equal(restored.timeSeconds, sim.world.timeSeconds);
  assert.equal(restored.stars.size, sim.world.stars.size);
  assert.deepEqual(
    restored.physics.snapshot(),
    sim.world.physics.snapshot(),
  );
});

test("a restored world continues deterministically from where it left off", () => {
  const original = Simulation.fromSeed(2048);
  original.simulate(1e6);

  // Branch: keep simulating the original, vs. save/load then simulate.
  const save = JSON.parse(JSON.stringify(original.world.toSave())) as WorldSave;
  const restored = new Simulation(World.fromSave(save));

  original.simulate(5e5);
  restored.simulate(5e5);

  assert.deepEqual(
    restored.world.physics.snapshot(),
    original.world.physics.snapshot(),
  );
  assert.equal(restored.timeSeconds, original.timeSeconds);
});

test("save preserves engine configuration", () => {
  const sim = Simulation.fromSeed(7, { fixedDt: 1800 });
  const save = sim.world.toSave();
  assert.equal(save.engine.G, sim.world.physics.config.G);
  assert.equal(save.engine.theta, sim.world.physics.config.theta);
  assert.equal(save.engine.collisions, sim.world.physics.config.collisions);
});
