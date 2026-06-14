import { test } from "node:test";
import assert from "node:assert/strict";
import { Planet, habitableZoneAU } from "../src/entities/planet.ts";
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

test("Earth's equilibrium temperature is the textbook ~255 K", () => {
  const t = earth().equilibriumTemperatureK(SOLAR_LUMINOSITY);
  assert.ok(Math.abs(t - 255) < 3, `got ${t} K`);
});

test("the Sun's habitable zone brackets 1 AU", () => {
  const hz = habitableZoneAU(SOLAR_LUMINOSITY);
  assert.ok(hz.inner < 1 && hz.outer > 1, `zone ${hz.inner}–${hz.outer} AU`);
  assert.equal(earth().isInHabitableZone(SOLAR_LUMINOSITY), true);
  assert.ok(earth().habitabilityScore(SOLAR_LUMINOSITY) > 0.5);
});

test("a far, cold gas giant is uninhabitable", () => {
  const jupiter = new Planet({
    id: "j",
    mass: EARTH_MASS * 318,
    radius: 7e7,
    composition: "gas",
    semiMajorAxis: 5.2 * AU,
  });
  assert.equal(jupiter.isInHabitableZone(SOLAR_LUMINOSITY), false);
  assert.equal(jupiter.habitabilityScore(SOLAR_LUMINOSITY), 0);
});

test("equilibrium temperature falls with distance", () => {
  const near = new Planet({ id: "n", mass: EARTH_MASS, radius: EARTH_RADIUS, composition: "rocky", semiMajorAxis: 0.5 * AU });
  const far = new Planet({ id: "f", mass: EARTH_MASS, radius: EARTH_RADIUS, composition: "rocky", semiMajorAxis: 5 * AU });
  assert.ok(near.equilibriumTemperatureK(SOLAR_LUMINOSITY) > far.equilibriumTemperatureK(SOLAR_LUMINOSITY));
});
