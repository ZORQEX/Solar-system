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

console.log("  Gyr   biosphere       biomass  civ(K-level, pop)");
const chunkYears = 5e8; // 0.5 Gyr
for (let gyr = 0.5; gyr <= 8; gyr += 0.5) {
  sim.simulate(chunkYears * SECONDS_PER_YEAR);
  const bio = world.biospheres.get("earth")!;
  const civ = [...world.civilizations.values()][0];
  const civStr = civ
    ? `K${civ.kardashev.toFixed(2)}, ${civ.population.toExponential(2)}`
    : "—";
  console.log(
    `  ${gyr.toFixed(1).padStart(3)}   ${bio.stage.padEnd(14)}  ${bio.biomassFraction
      .toFixed(2)
      .padStart(5)}    ${civStr}`,
  );
}

const star = world.stars.get("star")!;
console.log(`\nstar after ${(world.timeSeconds / SECONDS_PER_YEAR / 1e9).toFixed(1)} Gyr: ${star.stage()}`);
