import * as THREE from "three";
import type { BodyData, PlanetSubtype } from "../shared.ts";
import { bodyColor, displayRadius, isLuminous, toScene } from "../three/scaling.ts";
import { ProceduralPlanet } from "./ProceduralPlanet.ts";
import { ProceduralAsteroid } from "./ProceduralAsteroid.ts";
import { AsteroidBelt } from "./AsteroidBelt.ts";
import type {
  AsteroidVisual,
  BiomePalette,
  CelestialObject,
  PlanetVisual,
  TerrainParams,
} from "./types.ts";

type RGB = readonly [number, number, number];

interface Spot {
  color: RGB;
  dir: RGB; // object-space direction to the spot centre
  size: number;
  strength: number;
}

interface SubtypeStyle {
  /** Rocky: 5 height-biome layers low→high. Banded: first 4 are band colours. */
  colors: readonly [RGB, RGB, RGB, RGB, RGB];
  terrain: TerrainParams;
  atmosphereColor: RGB;
  atmosphereIntensity: number; // 0 = no atmosphere shell
  cloudOpacity: number; // 0 = no cloud shell
  cloudColor: RGB;
  banded?: boolean; // gas/ice giants: latitude bands instead of height biomes
  bandFreq?: number;
  polarCaps?: boolean; // white latitude ice caps (Earth/Mars)
  spot?: Spot; // storm spot (Great Red Spot, Neptune dark spot)
}

const ROCKY = (
  type: 1 | 2 | 3,
  amplitude: number,
  sharpness: number,
  offset: number,
): TerrainParams => ({ type, amplitude, sharpness, offset, period: 0.6, persistence: 0.5, lacunarity: 1.9, octaves: 8 });

/** Per-subtype look. Named bodies are bespoke; the rest are generic fallbacks. */
const STYLES: Record<PlanetSubtype, SubtypeStyle> = {
  // --- named solar-system bodies ---
  "terrestrial-earth": {
    colors: [[0.102, 0.435, 0.659], [0.176, 0.608, 0.878], [0.176, 0.431, 0.176], [0.545, 0.412, 0.078], [1, 1, 1]],
    terrain: ROCKY(2, 0.16, 2.4, -0.075), // deep -offset → ~65% ocean
    atmosphereColor: [0.31, 0.639, 0.91], atmosphereIntensity: 1.3, cloudOpacity: 0.6, cloudColor: [1, 1, 1],
    polarCaps: true,
  },
  "terrestrial-venus": {
    colors: [[0.831, 0.51, 0.039], [0.788, 0.659, 0.298], [0.835, 0.604, 0.227], [0.722, 0.47, 0.039], [0.878, 0.69, 0.376]],
    terrain: ROCKY(3, 0.08, 1.4, -0.01), // low-relief volcanic ridges
    atmosphereColor: [0.878, 0.502, 0.188], atmosphereIntensity: 1.5, cloudOpacity: 0.95, cloudColor: [0.941, 0.816, 0.502],
  },
  "barren-mars": {
    colors: [[0.545, 0.145, 0.0], [0.757, 0.267, 0.055], [0.831, 0.4, 0.227], [0.788, 0.541, 0.353], [0.91, 0.91, 0.91]],
    terrain: ROCKY(3, 0.17, 1.3, -0.03),
    atmosphereColor: [0.78, 0.45, 0.3], atmosphereIntensity: 0.18, cloudOpacity: 0.0, cloudColor: [1, 1, 1],
    polarCaps: true,
  },
  "barren-mercury": {
    colors: [[0.227, 0.227, 0.227], [0.353, 0.353, 0.353], [0.533, 0.533, 0.533], [0.627, 0.627, 0.6], [0.753, 0.745, 0.71]],
    terrain: ROCKY(3, 0.2, 1.0, -0.02), // heavy sharp cratering
    atmosphereColor: [0.5, 0.45, 0.4], atmosphereIntensity: 0.0, cloudOpacity: 0.0, cloudColor: [1, 1, 1],
  },
  "gas-giant-jupiter": {
    colors: [[0.545, 0.271, 0.075], [0.824, 0.412, 0.118], [0.961, 0.871, 0.702], [1.0, 0.549, 0.0], [0.961, 0.871, 0.702]],
    terrain: ROCKY(1, 0.03, 1.0, 0.0),
    atmosphereColor: [0.831, 0.533, 0.165], atmosphereIntensity: 1.0, cloudOpacity: 0.0, cloudColor: [0.9, 0.8, 0.65],
    banded: true, bandFreq: 9,
    spot: { color: [0.62, 0.13, 0.05], dir: [0.65, -0.2, 0.73], size: 0.32, strength: 0.7 },
  },
  "gas-giant-saturn": {
    colors: [[0.784, 0.659, 0.51], [0.831, 0.686, 0.216], [0.961, 0.902, 0.784], [0.878, 0.773, 0.604], [0.961, 0.902, 0.784]],
    terrain: ROCKY(1, 0.025, 1.0, 0.0),
    atmosphereColor: [0.831, 0.784, 0.478], atmosphereIntensity: 0.9, cloudOpacity: 0.0, cloudColor: [0.92, 0.86, 0.72],
    banded: true, bandFreq: 8,
  },
  "ice-giant-uranus": {
    colors: [[0.49, 0.91, 0.91], [0.533, 0.918, 0.918], [0.573, 0.925, 0.925], [0.486, 0.878, 0.878], [0.49, 0.91, 0.91]],
    terrain: ROCKY(1, 0.02, 1.0, 0.0),
    atmosphereColor: [0.627, 0.941, 0.941], atmosphereIntensity: 0.9, cloudOpacity: 0.0, cloudColor: [0.7, 0.95, 0.95],
    banded: true, bandFreq: 3,
  },
  "ice-giant-neptune": {
    colors: [[0.0, 0.188, 0.8], [0.106, 0.31, 1.0], [0.165, 0.373, 1.0], [0.063, 0.247, 0.867], [0.106, 0.31, 1.0]],
    terrain: ROCKY(1, 0.02, 1.0, 0.0),
    atmosphereColor: [0.251, 0.502, 1.0], atmosphereIntensity: 1.0, cloudOpacity: 0.0, cloudColor: [0.6, 0.75, 1.0],
    banded: true, bandFreq: 5,
    spot: { color: [0.0, 0.102, 0.4], dir: [-0.6, 0.15, 0.78], size: 0.28, strength: 0.6 },
  },
  moon: {
    colors: [[0.267, 0.267, 0.267], [0.333, 0.333, 0.333], [0.533, 0.533, 0.533], [0.604, 0.604, 0.604], [0.69, 0.69, 0.69]],
    terrain: ROCKY(3, 0.18, 1.1, -0.02),
    atmosphereColor: [0.5, 0.5, 0.5], atmosphereIntensity: 0.0, cloudOpacity: 0.0, cloudColor: [1, 1, 1],
  },
  // --- generic fallbacks (procedural/custom bodies) ---
  terrestrial: {
    colors: [[0.02, 0.08, 0.25], [0.05, 0.45, 0.3], [0.6, 0.5, 0.35], [0.12, 0.22, 0.08], [0.85, 0.85, 0.85]],
    terrain: ROCKY(2, 0.15, 2.4, -0.05),
    atmosphereColor: [0.3, 0.6, 1.0], atmosphereIntensity: 1.3, cloudOpacity: 0.6, cloudColor: [1, 1, 1],
    polarCaps: true,
  },
  ocean: {
    colors: [[0.0, 0.07, 0.2], [0.0, 0.2, 0.4], [0.05, 0.4, 0.55], [0.5, 0.5, 0.4], [0.9, 0.95, 1.0]],
    terrain: ROCKY(2, 0.1, 2.0, -0.06),
    atmosphereColor: [0.3, 0.6, 1.0], atmosphereIntensity: 1.4, cloudOpacity: 0.7, cloudColor: [1, 1, 1],
  },
  "ice-world": {
    colors: [[0.25, 0.4, 0.55], [0.5, 0.7, 0.85], [0.75, 0.88, 0.95], [0.9, 0.95, 1.0], [1.0, 1.0, 1.0]],
    terrain: ROCKY(3, 0.12, 1.6, -0.01),
    atmosphereColor: [0.6, 0.8, 1.0], atmosphereIntensity: 0.8, cloudOpacity: 0.3, cloudColor: [0.9, 0.95, 1.0],
  },
  barren: {
    colors: [[0.22, 0.12, 0.08], [0.45, 0.24, 0.14], [0.6, 0.4, 0.28], [0.5, 0.46, 0.42], [0.78, 0.76, 0.72]],
    terrain: ROCKY(3, 0.16, 1.2, -0.02),
    atmosphereColor: [0.5, 0.4, 0.35], atmosphereIntensity: 0.0, cloudOpacity: 0.0, cloudColor: [1, 1, 1],
  },
  lava: {
    colors: [[0.08, 0.02, 0.0], [0.35, 0.05, 0.0], [0.7, 0.15, 0.0], [1.0, 0.45, 0.0], [1.0, 0.9, 0.4]],
    terrain: ROCKY(3, 0.18, 1.4, -0.02),
    atmosphereColor: [1.0, 0.4, 0.12], atmosphereIntensity: 1.1, cloudOpacity: 0.0, cloudColor: [0.4, 0.3, 0.3],
  },
  "gas-giant": {
    colors: [[0.545, 0.271, 0.075], [0.824, 0.412, 0.118], [0.961, 0.871, 0.702], [1.0, 0.549, 0.0], [0.961, 0.871, 0.702]],
    terrain: ROCKY(1, 0.03, 1.0, 0.0),
    atmosphereColor: [0.85, 0.7, 0.5], atmosphereIntensity: 1.0, cloudOpacity: 0.0, cloudColor: [0.92, 0.85, 0.7],
    banded: true, bandFreq: 8,
  },
  generic: {
    colors: [[0.3, 0.32, 0.36], [0.45, 0.46, 0.5], [0.55, 0.55, 0.58], [0.62, 0.6, 0.56], [0.8, 0.8, 0.82]],
    terrain: ROCKY(2, 0.14, 1.8, -0.03),
    atmosphereColor: [0.5, 0.6, 0.7], atmosphereIntensity: 0.5, cloudOpacity: 0.2, cloudColor: [0.9, 0.9, 0.9],
  },
};

/** Fixed, legibility-tuned scene radii for named bodies (override scaledRadius). */
const NAMED_RADII: Record<string, number> = {
  sun: 0.25,
  jupiter: 0.13,
  saturn: 0.11,
  uranus: 0.08,
  neptune: 0.08,
  earth: 0.052,
  terra: 0.052,
  venus: 0.05,
  mars: 0.036,
  mercury: 0.028,
  moon: 0.018,
  luna: 0.018,
};

// Where the biome layers sit within the [0, amplitude] height range, and how
// wide each blend is — both as fractions of amplitude, so they scale with it.
const TRANSITION_FRACTIONS: readonly [number, number, number, number] = [0.15, 0.4, 0.65, 0.9];
const BLEND_FRACTION = 0.08;

/** FNV-1a over the id, mixing in each char's position and a large prime. */
function hashId(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= Math.imul(id.charCodeAt(i), 0x9e3779b1) ^ i;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** splitmix32-style finalizer — fully decorrelates an integer hash. */
function mix32(x: number): number {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Three well-separated noise offsets (each from an independently-salted mix). */
function seedVec(id: string): THREE.Vector3 {
  const h = hashId(id);
  const x = mix32(h ^ 0x9e3779b9) / 4294967296;
  const y = mix32(h ^ 0x85ebca6b) / 4294967296;
  const z = mix32(h ^ 0xc2b2ae35) / 4294967296;
  return new THREE.Vector3(x * 200, y * 200, z * 200);
}

/** Per-instance asteroid seed, well spread across 0..100. */
function seedFloat(id: string): number {
  return (mix32(hashId(id)) / 4294967296) * 100;
}

/** Deterministic 0..1 value from the id, for parameter jitter. */
function seedUnit(id: string): number {
  return mix32(hashId(id) ^ 0x27d4eb2f) / 4294967296;
}

function color(rgb: RGB): THREE.Color {
  return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

/** A soft radial glow texture (white-yellow core → transparent), generated once. */
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, "rgba(255, 245, 204, 1.0)");
    g.addColorStop(0.3, "rgba(255, 240, 180, 0.55)");
    g.addColorStop(1.0, "rgba(255, 230, 150, 0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * A plain lit/emissive sphere for body kinds the procedural module doesn't
 * specialise (stars, remnants, generic). Luminous bodies also get an additive
 * billboard glow halo (replacing the renderer's old star glow).
 */
class SimpleBody implements CelestialObject {
  readonly object3D: THREE.Mesh;
  private readonly geometry: THREE.SphereGeometry;
  private readonly material: THREE.Material;
  private glowTexture: THREE.Texture | null = null;
  private glowMaterial: THREE.SpriteMaterial | null = null;

  constructor(body: BodyData, radius: number) {
    this.geometry = new THREE.SphereGeometry(radius, 32, 24);
    const c = bodyColor(body);
    const luminous = isLuminous(body);
    this.material = luminous
      ? new THREE.MeshBasicMaterial({ color: c })
      : new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.1 });
    this.object3D = new THREE.Mesh(this.geometry, this.material);

    if (luminous) {
      this.glowTexture = makeGlowTexture();
      this.glowMaterial = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xfff5cc,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Sprite(this.glowMaterial);
      glow.scale.setScalar(radius * 5); // soft halo ~2.5× the star radius
      this.object3D.add(glow); // Sprite auto-faces the camera
    }
  }

  update(): void {
    // Nothing per-frame: stars are unlit-bright, others lit by scene lights.
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.glowTexture?.dispose();
    this.glowMaterial?.dispose();
  }
}

/**
 * Owns the lifecycle of every body's visual representation. This is the ONLY
 * place that adds body meshes to the scene; Renderer keeps the scene, camera,
 * controls, starfield and RAF loop. Per-frame work happens in {@link update},
 * driven from Renderer's existing loop (no second RAF).
 */
export class CelestialFactory {
  private readonly objects = new Map<string, CelestialObject>();
  private readonly beltIds = new Set<string>();
  private belt: AsteroidBelt | null = null;
  /** Largest SI radius seen per body type, for relative sizing within a group. */
  private readonly maxRadiusByType = new Map<string, number>();

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Reconcile rendered objects with the latest body set: create new ones,
   * dispose removed ones, and maintain belt membership. Call on each snapshot.
   */
  sync(bodies: readonly BodyData[]): void {
    const present = new Set<string>();

    // Largest SI radius per type, so bodies can be sized relative to their peers.
    this.maxRadiusByType.clear();
    for (const b of bodies) {
      this.maxRadiusByType.set(b.type, Math.max(this.maxRadiusByType.get(b.type) ?? 0, b.radius));
    }

    for (const body of bodies) {
      present.add(body.id);
      if (body.type === "asteroid") {
        const belt = this.ensureBelt();
        if (!belt.has(body.id)) {
          belt.add(body.id, seedFloat(body.id));
          this.beltIds.add(body.id);
        }
        continue;
      }
      if (!this.objects.has(body.id)) {
        const obj = this.createObject(body);
        obj.object3D.userData.id = body.id; // for click-to-select raycasting
        this.objects.set(body.id, obj);
        this.scene.add(obj.object3D); // sole scene.add for body meshes
      }
    }

    for (const [id, obj] of this.objects) {
      if (!present.has(id)) {
        this.scene.remove(obj.object3D);
        obj.dispose();
        this.objects.delete(id);
      }
    }
    if (this.belt) {
      for (const id of [...this.beltIds]) {
        if (!present.has(id)) {
          this.belt.remove(id);
          this.beltIds.delete(id);
        }
      }
    }
  }

  /**
   * Per-frame update from Renderer's RAF loop. Positions each body from the
   * latest snapshot, then updates its shader (sun position + LOD by camera
   * distance). `sunPosition` is the scene-space position of the star (Renderer
   * derives it from bodies where type === 'star').
   */
  update(
    bodies: readonly BodyData[],
    sunPosition: THREE.Vector3,
    cameraPosition: THREE.Vector3,
    dt: number,
  ): void {
    for (const body of bodies) {
      const p = toScene(body.position);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) continue;

      if (body.type === "asteroid") {
        this.belt?.setTransform(body.id, p, this.scaledRadius(body));
        continue;
      }
      const obj = this.objects.get(body.id);
      if (!obj) continue;
      obj.object3D.position.copy(p);
      const camDist = cameraPosition.distanceTo(p);
      obj.update(dt, sunPosition, camDist);
    }
    this.belt?.update(sunPosition);
  }

  /** Pickable root meshes (excludes the asteroid belt) for click selection. */
  pickables(): THREE.Object3D[] {
    return [...this.objects.values()].map((o) => o.object3D);
  }

  dispose(): void {
    for (const obj of this.objects.values()) {
      this.scene.remove(obj.object3D);
      obj.dispose();
    }
    this.objects.clear();
    if (this.belt) {
      this.scene.remove(this.belt.object3D);
      this.belt.dispose();
      this.belt = null;
    }
    this.beltIds.clear();
  }

  // --- internals -----------------------------------------------------------

  /**
   * Visual radius: the type's base `displayRadius` scaled by this body's SI
   * radius relative to the largest of its type, clamped to [0.4, 1.0]× so a body
   * never goes sub-pixel or exceeds the base. Gas giants get a ×1.4 legibility
   * boost so they read as dominant even at large orbital distances — a
   * deliberate non-physical choice (displayRadius itself is left untouched).
   * (Stars/black-holes are rendered by SimpleBody at base size, not via here.)
   */
  private scaledRadius(body: BodyData): number {
    const typeBoost = body.type === "gas-giant" ? 1.4 : 1.0;
    const base = displayRadius(body) * typeBoost;
    const maxR = this.maxRadiusByType.get(body.type) ?? body.radius;
    const factor = maxR > 0 ? body.radius / maxR : 1;
    return base * Math.min(1.0, Math.max(0.4, factor));
  }

  /** Render radius: a fixed legibility size for named bodies, else scaledRadius. */
  private visualRadius(body: BodyData): number {
    const fixed = NAMED_RADII[(body.name ?? body.id).toLowerCase()];
    return fixed ?? this.scaledRadius(body);
  }

  private ensureBelt(): AsteroidBelt {
    if (!this.belt) {
      this.belt = new AsteroidBelt();
      this.scene.add(this.belt.object3D); // sole scene.add for body meshes
    }
    return this.belt;
  }

  private createObject(body: BodyData): CelestialObject {
    switch (body.type) {
      case "planet":
      case "gas-giant":
      case "moon":
        return new ProceduralPlanet(this.planetVisual(body));
      case "comet":
        return new ProceduralAsteroid(this.asteroidVisual(body));
      default:
        // star, neutron-star, black-hole, generic
        return new SimpleBody(body, this.visualRadius(body));
    }
  }

  /**
   * Derive a planet subtype when the body doesn't carry one.
   *
   * Thresholds (tuned against solar-system bodies; `density = mass / (4/3·π·r³)`
   * in kg/m³ — the physical mean density):
   *   - type === 'gas-giant'                        → 'gas-giant'
   *   - radius > 1.5e7 m AND density < 2500          → 'ice-world'  (Neptune-like)
   *   - radius < 3.5e6 m                             → 'barren'     (Mercury/Mars/Moon)
   *   - density > 8000                               → 'lava'       (unusually dense/hot, rare)
   *   - else                                         → 'terrestrial' (Earth/Venus)
   * Sanity check on our data: Earth/Venus → terrestrial, Mars/Mercury/Moon →
   * barren, Neptune/Uranus → gas-giant (by type), generated icy planets → ice-world.
   */
  private deriveSubtype(body: BodyData): PlanetSubtype {
    // 1. Named solar-system bodies get their bespoke look (exact name match).
    const name = (body.name ?? body.id).toLowerCase();
    const named: Record<string, PlanetSubtype> = {
      earth: "terrestrial-earth", terra: "terrestrial-earth",
      venus: "terrestrial-venus",
      mars: "barren-mars",
      mercury: "barren-mercury",
      jupiter: "gas-giant-jupiter",
      saturn: "gas-giant-saturn",
      uranus: "ice-giant-uranus",
      neptune: "ice-giant-neptune",
      moon: "moon", luna: "moon",
    };
    if (named[name]) return named[name]!;
    if (body.type === "moon") return "moon";

    // 2. Explicit override.
    if (body.subtype) return body.subtype;

    // 3. Fall back to type + mass/radius (density = mass / (4/3·π·r³), kg/m³).
    if (body.type === "gas-giant") return "gas-giant";
    const r = body.radius;
    const density = body.mass / ((4 / 3) * Math.PI * r * r * r);
    if (r > 1.5e7 && density < 2500) return "ice-world";
    if (r < 3.5e6) return "barren";
    if (density > 8000) return "lava";
    return "terrestrial";
  }

  private planetVisual(body: BodyData): PlanetVisual {
    const subtype = this.deriveSubtype(body);
    const style = STYLES[subtype];
    const terrain = { ...style.terrain };
    // Per-body jitter so same-subtype worlds differ in feature scale + sea level.
    const u = seedUnit(body.id);
    terrain.period *= 0.75 + 0.5 * u;
    terrain.offset += (u - 0.5) * 0.04 * terrain.amplitude;
    const amp = terrain.amplitude;
    const transitions: [number, number, number, number] = [
      TRANSITION_FRACTIONS[0] * amp,
      TRANSITION_FRACTIONS[1] * amp,
      TRANSITION_FRACTIONS[2] * amp,
      TRANSITION_FRACTIONS[3] * amp,
    ];
    const b = BLEND_FRACTION * amp;
    const palette: BiomePalette = {
      colors: [
        color(style.colors[0]),
        color(style.colors[1]),
        color(style.colors[2]),
        color(style.colors[3]),
        color(style.colors[4]),
      ],
      transitions,
      blends: [b, b, b, b],
    };
    const spot = style.spot;
    return {
      subtype,
      radius: this.visualRadius(body),
      seed: seedVec(body.id),
      terrain,
      palette,
      atmosphereColor: color(style.atmosphereColor),
      atmosphereIntensity: style.atmosphereIntensity,
      cloudOpacity: style.cloudOpacity,
      cloudColor: color(style.cloudColor),
      banded: style.banded ?? false,
      bandFreq: style.bandFreq ?? 8,
      polarCaps: style.polarCaps ? 1 : 0,
      spotColor: color(spot ? spot.color : [0, 0, 0]),
      spotDir: spot
        ? new THREE.Vector3(spot.dir[0], spot.dir[1], spot.dir[2]).normalize()
        : new THREE.Vector3(1, 0, 0),
      spotStrength: spot ? spot.strength : 0,
      spotSize: spot ? spot.size : 0,
    };
  }

  private asteroidVisual(body: BodyData): AsteroidVisual {
    return {
      radius: this.scaledRadius(body),
      seed: seedFloat(body.id),
      color: bodyColor(body),
      amplitude: 0.4,
    };
  }
}
