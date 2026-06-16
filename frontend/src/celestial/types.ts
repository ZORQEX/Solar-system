import * as THREE from "three";
import type { PlanetSubtype } from "../shared.ts";

/**
 * Common lifecycle for anything the {@link CelestialFactory} renders for a body.
 * The factory owns scene attachment; objects only build/update/free themselves.
 */
export interface CelestialObject {
  /** Root node added to the scene by the factory (never by the object itself). */
  readonly object3D: THREE.Object3D;
  /**
   * Per-frame update.
   * @param dt        seconds since last frame (real time)
   * @param sunPosition  world-space (scene units) position of the sun; shaders
   *                     compute per-fragment light direction from it
   * @param cameraDistance  distance from the camera to this body (scene units, for LOD)
   */
  update(dt: number, sunPosition: THREE.Vector3, cameraDistance: number): void;
  /** Free all GPU resources owned by this object (materials, geometry it created). */
  dispose(): void;
}

/** Noise terrain types, matching the reference's `terrainHeight` dispatch. */
export type TerrainType = 1 | 2 | 3; // 1 = simplex, 2 = fractal (billowy), 3 = ridged

/** Terrain noise parameters for the planet surface shader. */
export interface TerrainParams {
  type: TerrainType;
  /** Displacement as a fraction of the planet's radius (kept small for our scale). */
  amplitude: number;
  sharpness: number;
  offset: number;
  period: number;
  persistence: number;
  lacunarity: number;
  octaves: number;
}

/**
 * Height-banded biome palette — the reference's 5-layer model: five colours
 * blended across four height transitions, each with its own blend width.
 */
export interface BiomePalette {
  colors: [THREE.Color, THREE.Color, THREE.Color, THREE.Color, THREE.Color];
  /** Height thresholds between layers (transition2..5 in the reference). */
  transitions: [number, number, number, number];
  /** Blend half-widths around each transition (blend12,23,34,45). */
  blends: [number, number, number, number];
}

/** Everything needed to render one procedural planet, derived from a Body. */
export interface PlanetVisual {
  subtype: PlanetSubtype;
  /** Visual radius in scene units (from the renderer's displayRadius). */
  radius: number;
  /** Deterministic per-body noise offset (from the body id hash). */
  seed: THREE.Vector3;
  terrain: TerrainParams;
  palette: BiomePalette;
  atmosphereColor: THREE.Color;
  atmosphereIntensity: number;
  /** 0 disables the cloud shell. */
  cloudOpacity: number;
  cloudColor: THREE.Color;

  // --- surface style ---
  /**
   * Moons: a quieter, cheaper look — flat diffuse base colour + crater bump
   * only, skipping the 5-layer biome blend, polar caps, bands and spot. Keeps
   * moons visually secondary to planets.
   */
  simple: boolean;
  /** Gas/ice giants: horizontal latitude bands instead of height biomes. */
  banded: boolean;
  /** Number of bands when `banded`. */
  bandFreq: number;
  /** 1 = white latitude ice caps (Earth/Mars); 0 = none. */
  polarCaps: number;
  /** Storm-spot tint (Great Red Spot / Neptune dark spot); strength 0 disables. */
  spotColor: THREE.Color;
  /** Direction (object space) to the spot centre. */
  spotDir: THREE.Vector3;
  spotStrength: number;
  spotSize: number;
}

/** Everything needed to render one asteroid (single body or belt instance). */
export interface AsteroidVisual {
  /** Visual radius in scene units. */
  radius: number;
  /** Deterministic per-body seed. */
  seed: number;
  color: THREE.Color;
  /** Lumpiness as a fraction of radius. */
  amplitude: number;
}
