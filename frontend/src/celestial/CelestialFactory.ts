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

interface SubtypeStyle {
  colors: readonly [RGB, RGB, RGB, RGB, RGB];
  terrain: TerrainParams;
  atmosphereColor: RGB;
  atmosphereIntensity: number; // 0 = no atmosphere shell
  cloudOpacity: number; // 0 = no cloud shell
  cloudColor: RGB;
}

/** Per-subtype look (5-layer biome colours + terrain noise + atmosphere/clouds). */
const STYLES: Record<PlanetSubtype, SubtypeStyle> = {
  terrestrial: {
    colors: [[0.02, 0.08, 0.25], [0.05, 0.45, 0.3], [0.6, 0.5, 0.35], [0.12, 0.22, 0.08], [0.85, 0.85, 0.85]],
    terrain: { type: 2, amplitude: 0.15, sharpness: 2.6, offset: -0.03, period: 0.6, persistence: 0.48, lacunarity: 1.9, octaves: 8 },
    atmosphereColor: [0.3, 0.6, 1.0], atmosphereIntensity: 1.3, cloudOpacity: 0.6, cloudColor: [1, 1, 1],
  },
  ocean: {
    colors: [[0.0, 0.07, 0.2], [0.0, 0.2, 0.4], [0.05, 0.4, 0.55], [0.5, 0.5, 0.4], [0.9, 0.95, 1.0]],
    terrain: { type: 2, amplitude: 0.1, sharpness: 2.0, offset: -0.04, period: 0.7, persistence: 0.5, lacunarity: 1.8, octaves: 7 },
    atmosphereColor: [0.3, 0.6, 1.0], atmosphereIntensity: 1.4, cloudOpacity: 0.7, cloudColor: [1, 1, 1],
  },
  "ice-world": {
    colors: [[0.25, 0.4, 0.55], [0.5, 0.7, 0.85], [0.75, 0.88, 0.95], [0.9, 0.95, 1.0], [1.0, 1.0, 1.0]],
    terrain: { type: 3, amplitude: 0.12, sharpness: 1.6, offset: -0.01, period: 0.5, persistence: 0.5, lacunarity: 2.0, octaves: 7 },
    atmosphereColor: [0.6, 0.8, 1.0], atmosphereIntensity: 0.8, cloudOpacity: 0.3, cloudColor: [0.9, 0.95, 1.0],
  },
  barren: {
    colors: [[0.22, 0.12, 0.08], [0.45, 0.24, 0.14], [0.6, 0.4, 0.28], [0.5, 0.46, 0.42], [0.78, 0.76, 0.72]],
    terrain: { type: 3, amplitude: 0.16, sharpness: 1.2, offset: -0.02, period: 0.4, persistence: 0.55, lacunarity: 2.1, octaves: 8 },
    atmosphereColor: [0.5, 0.4, 0.35], atmosphereIntensity: 0.0, cloudOpacity: 0.0, cloudColor: [1, 1, 1],
  },
  lava: {
    colors: [[0.08, 0.02, 0.0], [0.35, 0.05, 0.0], [0.7, 0.15, 0.0], [1.0, 0.45, 0.0], [1.0, 0.9, 0.4]],
    terrain: { type: 3, amplitude: 0.18, sharpness: 1.4, offset: -0.02, period: 0.45, persistence: 0.5, lacunarity: 2.0, octaves: 8 },
    atmosphereColor: [1.0, 0.4, 0.12], atmosphereIntensity: 1.1, cloudOpacity: 0.0, cloudColor: [0.4, 0.3, 0.3],
  },
  "gas-giant": {
    colors: [[0.55, 0.45, 0.32], [0.78, 0.66, 0.46], [0.88, 0.8, 0.62], [0.7, 0.55, 0.4], [0.95, 0.92, 0.82]],
    terrain: { type: 1, amplitude: 0.04, sharpness: 1.0, offset: 0.0, period: 0.5, persistence: 0.5, lacunarity: 2.0, octaves: 4 },
    atmosphereColor: [0.85, 0.7, 0.5], atmosphereIntensity: 1.0, cloudOpacity: 0.4, cloudColor: [0.92, 0.85, 0.7],
  },
};

// Where the biome layers sit within the [0, amplitude] height range, and how
// wide each blend is — both as fractions of amplitude, so they scale with it.
const TRANSITION_FRACTIONS: readonly [number, number, number, number] = [0.15, 0.4, 0.65, 0.9];
const BLEND_FRACTION = 0.08;

/** FNV-1a hash of the body id → stable uint32, the basis for deterministic seeds. */
function hashId(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seedVec(id: string): THREE.Vector3 {
  const h = hashId(id);
  const a = (h & 0xffff) / 0xffff;
  const b = ((h >>> 8) & 0xffff) / 0xffff;
  const c = ((h >>> 16) & 0xffff) / 0xffff;
  return new THREE.Vector3(a * 100, b * 100, c * 100);
}

function seedFloat(id: string): number {
  return (hashId(id) % 100000) / 1000; // 0..100
}

function color(rgb: RGB): THREE.Color {
  return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

/**
 * A plain lit/emissive sphere for body kinds the procedural module doesn't
 * specialise (stars, remnants, generic). Lit by the scene's existing lights.
 */
class SimpleBody implements CelestialObject {
  readonly object3D: THREE.Mesh;
  private readonly geometry: THREE.SphereGeometry;
  private readonly material: THREE.Material;

  constructor(body: BodyData) {
    this.geometry = new THREE.SphereGeometry(displayRadius(body), 32, 24);
    const c = bodyColor(body);
    this.material = isLuminous(body)
      ? new THREE.MeshBasicMaterial({ color: c })
      : new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.1 });
    this.object3D = new THREE.Mesh(this.geometry, this.material);
  }

  update(): void {
    // Nothing per-frame: stars are unlit-bright, others lit by scene lights.
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
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

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Reconcile rendered objects with the latest body set: create new ones,
   * dispose removed ones, and maintain belt membership. Call on each snapshot.
   */
  sync(bodies: readonly BodyData[]): void {
    const present = new Set<string>();

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
        this.belt?.setTransform(body.id, p, displayRadius(body));
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
        return new SimpleBody(body);
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
    if (body.subtype) return body.subtype;
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
    return {
      subtype,
      radius: displayRadius(body),
      seed: seedVec(body.id),
      terrain,
      palette,
      atmosphereColor: color(style.atmosphereColor),
      atmosphereIntensity: style.atmosphereIntensity,
      cloudOpacity: style.cloudOpacity,
      cloudColor: color(style.cloudColor),
    };
  }

  private asteroidVisual(body: BodyData): AsteroidVisual {
    return {
      radius: displayRadius(body),
      seed: seedFloat(body.id),
      color: bodyColor(body),
      amplitude: 0.4,
    };
  }
}
