import { test } from "node:test";
import assert from "node:assert/strict";
import { Body, PhysicsEngine, Vector3 } from "../src/core/index.ts";
import { Planet, Star, createBiosphere } from "../src/entities/index.ts";
import { Simulation, World } from "../src/simulation/index.ts";
import { createLifeMod, createDragMod, createExpansionMod } from "../src/mods/index.ts";
import { AU, EARTH_MASS, EARTH_RADIUS, SECONDS_PER_YEAR, SOLAR_MASS } from "../src/shared.ts";

test("the life mod grows a civilization on a habitable world", () => {
  const world = new World(new PhysicsEngine([], { collisions: false }), "Test");
  world.registerStar(new Star({ id: "star", mass: SOLAR_MASS, ageYears: 1e9 }));
  world.registerPlanet(
    new Planet({
      id: "earth",
      name: "Earth",
      mass: EARTH_MASS,
      radius: EARTH_RADIUS,
      composition: "rocky",
      semiMajorAxis: AU,
    }),
  );
  world.registerBiosphere(createBiosphere("earth"));

  const sim = new Simulation(world, { seed: 1 });
  sim.use(createLifeMod());

  // 5 Gyr — within the Sun's main-sequence life, plenty for life to mature.
  sim.simulate(5e9 * SECONDS_PER_YEAR);

  assert.ok(world.biospheres.get("earth")!.stage !== "abiogenesis");
  assert.ok(world.civilizations.size >= 1, "a civilization should have emerged");
  const civ = [...world.civilizations.values()][0]!;
  assert.ok(civ.population >= 1000);
});

test("a drag force-field mod bleeds off velocity", () => {
  const body = new Body({ id: "p", mass: 1, radius: 0, position: new Vector3(0, 0, 0), velocity: new Vector3(1, 0, 0) });
  const sim = new Simulation(new World(new PhysicsEngine([body], { collisions: false })), {
    fixedDt: 0.05,
    maxSubstepsPerStep: 100000,
  });
  sim.use(createDragMod(0.5));

  const v0 = body.velocity.length();
  sim.simulate(2); // 2 seconds of drag
  const v1 = body.velocity.length();
  assert.ok(v1 < v0 * 0.6 && v1 > 0, `speed ${v1} should decay below ${v0 * 0.6}`);
});

test("an expansion force-field mod pushes bodies apart", () => {
  const a = new Body({ id: "a", mass: 1, radius: 0, position: new Vector3(-1, 0, 0) });
  const b = new Body({ id: "b", mass: 1, radius: 0, position: new Vector3(1, 0, 0) });
  const sim = new Simulation(new World(new PhysicsEngine([a, b], { collisions: false })), {
    fixedDt: 0.1,
    maxSubstepsPerStep: 100000,
  });
  sim.use(createExpansionMod(0.2));

  const before = a.position.distance(b.position);
  sim.simulate(10);
  assert.ok(a.position.distance(b.position) > before, "bodies should drift apart");
});

test("mods registered with a force field are installed on the engine", () => {
  const sim = new Simulation(new World(new PhysicsEngine([], {})));
  assert.equal(sim.world.physics.forceFields.length, 0);
  sim.use(createDragMod(0.1));
  assert.equal(sim.world.physics.forceFields.length, 1);
  assert.equal(sim.mods.length, 1);
});
