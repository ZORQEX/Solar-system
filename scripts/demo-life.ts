/**
 * Demo: watch life emerge and a civilization rise on an Earth-like world over
 * billions of years.  Run with:  npm run demo:life
 */
import { PhysicsEngine } from "../backend/src/core/index.ts";
import { Planet, Star, createBiosphere } from "../backend/src/entities/index.ts";
import { Simulation, World } from "../backend/src/simulation/index.ts";
import { createLifeMod } from "../backend/src/mods/index.ts";
import {
  AU,
  EARTH_MASS,
  EARTH_RADIUS,
  SECONDS_PER_YEAR,
  SOLAR_MASS,
} from "../shared/src/constants.ts";

const world = new World(new PhysicsEngine([], { collisions: false }), "Sol-like");
world.registerStar(new Star({ id: "star", mass: SOLAR_MASS, ageYears: 1e8 }));
world.registerPlanet(
  new Planet({
    id: "earth",
    name: "Terra",
    mass: EARTH_MASS,
    radius: EARTH_RADIUS,
    composition: "rocky",
    semiMajorAxis: AU,
  }),
);
world.registerBiosphere(createBiosphere("earth"));

const sim = new Simulation(world, { seed: 2049 });
sim.use(createLifeMod());

const star = world.stars.get("star")!;
console.log("  Gyr   star            biosphere       biomass  civ(K-level, pop)");
const chunkYears = 1e9; // 1 Gyr
for (let gyr = 1; gyr <= 13; gyr += 1) {
  sim.simulate(chunkYears * SECONDS_PER_YEAR);
  const bio = world.biospheres.get("earth")!;
  const civ = [...world.civilizations.values()][0];
  const civStr = civ
    ? `K${civ.kardashev.toFixed(2)}, ${civ.population.toExponential(2)}`
    : "— (none)";
  console.log(
    `  ${gyr.toFixed(0).padStart(3)}   ${star.stage().padEnd(14)}  ${bio.stage.padEnd(
      14,
    )}  ${bio.biomassFraction.toFixed(2).padStart(5)}    ${civStr}`,
  );
}

console.log(
  `\nAfter ${(world.timeSeconds / SECONDS_PER_YEAR / 1e9).toFixed(1)} Gyr the star is a ${star.stage()} ` +
    `and its world is ${world.civilizations.size === 0 ? "lifeless" : "still inhabited"}.`,
);
