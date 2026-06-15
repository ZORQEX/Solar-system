/** Public surface of the procedural celestial module. */
export { CelestialFactory } from "./CelestialFactory.ts";
export { ProceduralPlanet } from "./ProceduralPlanet.ts";
export { ProceduralAsteroid } from "./ProceduralAsteroid.ts";
export { AsteroidBelt } from "./AsteroidBelt.ts";
export type {
  CelestialObject,
  PlanetVisual,
  AsteroidVisual,
  BiomePalette,
  TerrainParams,
  TerrainType,
} from "./types.ts";
export { NOISE_GLSL, withNoise } from "./noise/index.ts";
