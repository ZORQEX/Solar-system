import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Planet,
  Rng,
  createBiosphere,
  type Civilization,
} from "../src/entities/index.ts";
import { evolveBiosphere, evolveCivilization } from "../src/ai/index.ts";
import { AU, EARTH_MASS, EARTH_RADIUS, SOLAR_LUMINOSITY } from "../src/shared.ts";

function earth(): Planet {
  return new Planet({
    id: "earth",
    mass: EARTH_MASS,
    radius: EARTH_RADIUS,
    composition: "rocky",
    semiMajorAxis: AU,
  });
}

test("life on a perfect world races to a spacefaring biosphere", () => {
  const bio = createBiosphere("earth");
  // A very long span makes every transition near-certain → full cascade.
  const stage = evolveBiosphere(bio, earth(), SOLAR_LUMINOSITY, 1e11, new Rng(1));
  assert.equal(stage, "spacefaring");
  assert.ok(bio.biomassFraction > 0.99);
  assert.ok(bio.ageYears >= 1e11);
});

test("life cannot take hold on a hostile world", () => {
  const jupiter = new Planet({
    id: "j",
    mass: EARTH_MASS * 318,
    radius: 7e7,
    composition: "gas",
    semiMajorAxis: 5.2 * AU,
  });
  const bio = createBiosphere("j");
  bio.biomassFraction = 0.5;
  const stage = evolveBiosphere(bio, jupiter, SOLAR_LUMINOSITY, 1e9, new Rng(1));
  assert.equal(stage, "abiogenesis"); // never progresses
  assert.ok(bio.biomassFraction < 0.5); // biomass decays
});

test("a civilization grows in population, tech and Kardashev level", () => {
  const civ: Civilization = {
    id: "c",
    homePlanetId: "earth",
    name: "Humanity",
    kardashev: 0,
    population: 1000,
    techLevel: 0.1,
  };

  for (let i = 0; i < 50; i++) evolveCivilization(civ, 1e5);

  assert.ok(civ.population > 1000);
  assert.ok(civ.techLevel > 0.1);
  assert.ok(civ.kardashev > 0 && civ.kardashev <= 3);
});

test("a brain network modulates civilization growth deterministically", () => {
  const make = (): Civilization => ({
    id: "c",
    homePlanetId: "p",
    name: undefined,
    kardashev: 0,
    population: 1e6,
    techLevel: 1,
  });
  const a = make();
  const b = make();
  // Same evolution, run twice — must be identical (no hidden randomness).
  for (let i = 0; i < 10; i++) evolveCivilization(a, 1e4);
  for (let i = 0; i < 10; i++) evolveCivilization(b, 1e4);
  assert.equal(a.techLevel, b.techLevel);
  assert.equal(a.population, b.population);
});
