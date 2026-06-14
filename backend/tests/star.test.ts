import { test } from "node:test";
import assert from "node:assert/strict";
import { Star } from "../src/entities/star.ts";
import { SOLAR_MASS, SOLAR_LUMINOSITY } from "../src/shared.ts";

test("a Sun-mass star reproduces the Sun's basic properties", () => {
  const sun = new Star({ id: "sun", mass: SOLAR_MASS, ageYears: 4.6e9 });
  assert.equal(sun.spectralClass(), "G");
  assert.ok(Math.abs(sun.temperatureK() - 5772) < 1, "≈ 5772 K");
  assert.ok(Math.abs(sun.luminosityWatts() / SOLAR_LUMINOSITY - 1) < 1e-9);
  assert.ok(Math.abs(sun.mainSequenceLifetimeYears - 1e10) < 1, "≈ 10 Gyr");
  assert.equal(sun.stage(), "main-sequence");
});

test("remnant type is fixed by initial mass", () => {
  const dwarf = new Star({ id: "a", mass: 1 * SOLAR_MASS });
  const ns = new Star({ id: "b", mass: 12 * SOLAR_MASS });
  const bh = new Star({ id: "c", mass: 30 * SOLAR_MASS });
  const brown = new Star({ id: "d", mass: 0.05 * SOLAR_MASS });

  assert.equal(dwarf.remnantType(), "white-dwarf");
  assert.equal(ns.remnantType(), "neutron-star");
  assert.equal(bh.remnantType(), "black-hole");
  assert.equal(brown.stage(), "brown-dwarf");
});

test("a massive star evolves quickly through its stages", () => {
  // 25 M☉ — short-lived, ends as a black hole.
  const star = new Star({ id: "massive", mass: 25 * SOLAR_MASS });
  assert.equal(star.stage(), "main-sequence");
  assert.ok(star.mainSequenceLifetimeYears < 1e7, "lives < 10 Myr");

  // Age it well past its main-sequence lifetime.
  const changed = star.evolve(star.mainSequenceLifetimeYears * 2);
  assert.equal(changed, true);
  assert.equal(star.stage(), "black-hole");
  assert.equal(star.currentBodyType(), "black-hole");
  assert.ok(star.schwarzschildRadius() > 0);
  assert.equal(star.temperatureK(), 0); // no light escapes
});

test("hotter stars are bluer (earlier spectral class)", () => {
  const m = new Star({ id: "m", mass: 0.3 * SOLAR_MASS });
  const o = new Star({ id: "o", mass: 20 * SOLAR_MASS });
  assert.ok(o.temperatureK() > m.temperatureK());
  // O/B-class hot star vs cool red dwarf.
  assert.ok(["O", "B"].includes(o.spectralClass()));
});
