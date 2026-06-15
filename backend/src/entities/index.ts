/** Public surface of the entities module. */
export { Rng } from "./random.ts";
export { Star, type StarStage, type SpectralClass } from "./star.ts";
export {
  Planet,
  habitableZoneAU,
  type PlanetComposition,
} from "./planet.ts";
export {
  createBiosphere,
  BIOSPHERE_STAGES,
  type Biosphere,
  type BiosphereStage,
  type Civilization,
} from "./life.ts";
export {
  generateStarSystem,
  generateStarCluster,
  generateGalaxy,
  type StarSystem,
  type StarSystemOptions,
  type StarClusterOptions,
  type GalaxyOptions,
} from "./generators.ts";
