import * as THREE from "three";
import majorVertSrc from "./shaders/satellite-major.vert.glsl?raw";
import majorFragSrc from "./shaders/satellite-major.frag.glsl?raw";
import swarmVertSrc from "./shaders/satellite-swarm.vert.glsl?raw";
import swarmFragSrc from "./shaders/satellite-swarm.frag.glsl?raw";
import { withNoise } from "./noise/index.ts";
import type { ParentSatelliteConfig } from "./satelliteData.ts";

const TWO_PI = Math.PI * 2;
const SECONDS_PER_DAY = 86400;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** FNV-1a hash of a string → 32-bit unsigned, for deterministic seeding. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG → deterministic [0,1) sequence from a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Precomputed analytic orbit for one satellite (major or swarm member). */
interface Orbit {
  radius: number; // scene units, in the parent's local frame
  incRad: number; // inclination tilt
  angularSpeed: number; // rad per simulated second (signed: <0 = retrograde)
  initialAngle: number; // deterministic starting phase
}

/**
 * Decorative satellite system for one planet: a small {@link THREE.InstancedMesh}
 * of named "major" moons plus a {@link THREE.Points} swarm of generic moonlets.
 * Both are meant to be added as children of the planet's group (so they inherit
 * its position), and are NEVER added to any raycast/selection list.
 *
 * Motion is simple analytic Kepler-ish circular orbits driven by the shared
 * simulation clock (see {@link update}); there is no physics here.
 */
export class SatelliteSystem {
  readonly majorsMesh: THREE.InstancedMesh;
  readonly swarmPoints: THREE.Points;

  private readonly majorOrbits: Orbit[];
  private readonly majorScale: number;
  // Parallel arrays for the swarm (avoids per-point object allocation).
  private readonly swarmRadius: Float32Array;
  private readonly swarmInc: Float32Array;
  private readonly swarmSpeed: Float32Array;
  private readonly swarmAngle: Float32Array;

  private readonly dummy = new THREE.Object3D();
  private readonly majorGeometry: THREE.SphereGeometry;
  private readonly majorMaterial: THREE.ShaderMaterial;
  private readonly swarmGeometry: THREE.BufferGeometry;
  private readonly swarmMaterial: THREE.ShaderMaterial;

  constructor(config: ParentSatelliteConfig, parentVisualRadius: number) {
    const parentHash = hashStr(config.parentName);

    // --- majors: log-spaced by real distance, 1.3×–5.0× the parent radius ---
    const dists = config.majors.map((m) => m.distanceKm);
    const logMin = Math.log(Math.min(...dists));
    const logSpan = Math.log(Math.max(...dists)) - logMin;
    this.majorOrbits = config.majors.map((m, i) => {
      const nlr = logSpan > 1e-9 ? (Math.log(m.distanceKm) - logMin) / logSpan : 0.5;
      const rng = mulberry32((parentHash + Math.imul(i + 1, 0x9e3779b1)) >>> 0);
      return {
        radius: parentVisualRadius * lerp(1.3, 5.0, nlr),
        incRad: THREE.MathUtils.degToRad(m.inclinationDeg),
        angularSpeed: (Math.sign(m.periodDays) * TWO_PI) / (Math.abs(m.periodDays) * SECONDS_PER_DAY),
        initialAngle: rng() * TWO_PI,
      };
    });
    this.majorScale = parentVisualRadius * 0.1; // tiny — never competes with the planet

    this.majorGeometry = new THREE.SphereGeometry(1, 16, 12);
    this.majorMaterial = new THREE.ShaderMaterial({
      vertexShader: majorVertSrc,
      fragmentShader: withNoise(majorFragSrc),
    });
    this.majorsMesh = new THREE.InstancedMesh(this.majorGeometry, this.majorMaterial, config.majors.length);
    this.majorsMesh.frustumCulled = false; // instances move; bounds would be stale
    const tint = new THREE.Color();
    config.majors.forEach((m, i) => {
      tint.set(m.color);
      this.majorsMesh.setColorAt(i, tint);
    });
    if (this.majorsMesh.instanceColor) this.majorsMesh.instanceColor.needsUpdate = true;

    // --- swarm: synthetic log-distributed population beyond the outer major ---
    const n = config.swarm.count;
    const outerMajor = this.majorOrbits.length
      ? Math.max(...this.majorOrbits.map((o) => o.radius))
      : parentVisualRadius * 2;
    const logInner = Math.log(outerMajor * 1.1);
    const logOuter = Math.log(outerMajor * 7);
    const [incMin, incMax] = config.swarm.inclinationRangeDeg;

    this.swarmRadius = new Float32Array(n);
    this.swarmInc = new Float32Array(n);
    this.swarmSpeed = new Float32Array(n);
    this.swarmAngle = new Float32Array(n);
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);

    const base = new THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };
    for (let i = 0; i < n; i++) {
      const rng = mulberry32((parentHash ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0);
      const u = rng();
      const retro = rng() < config.swarm.retrogradeFraction;
      const incDeg = lerp(incMin, incMax, rng());
      const incNorm = incMax > incMin ? (incDeg - incMin) / (incMax - incMin) : 0;
      // High-inclination + retrograde members sit further out (captured-irregular pattern).
      const rank = clamp01(u * 0.7 + incNorm * 0.2 + (retro ? 0.1 : 0));
      const periodDays = lerp(200, 1300, rank); // outer → slower
      this.swarmRadius[i] = Math.exp(lerp(logInner, logOuter, rank));
      this.swarmInc[i] = THREE.MathUtils.degToRad(incDeg);
      this.swarmSpeed[i] = ((retro ? -1 : 1) * TWO_PI) / (periodDays * SECONDS_PER_DAY);
      this.swarmAngle[i] = rng() * TWO_PI;
      sizes[i] = 0.04 + rng() * 0.05;

      // Per-instance colour jitter in HSL: hue ±jitter·30°, lightness ±jitter·20%.
      base.set(config.swarm.baseColor);
      base.getHSL(hsl);
      const j = config.swarm.colorJitter;
      const h = (hsl.h + (rng() - 0.5) * 2 * j * (30 / 360) + 1) % 1;
      const l = clamp01(hsl.l + (rng() - 0.5) * 2 * j * 0.2);
      base.setHSL(h, hsl.s, l);
      colors[i * 3] = base.r;
      colors[i * 3 + 1] = base.g;
      colors[i * 3 + 2] = base.b;
    }

    this.swarmGeometry = new THREE.BufferGeometry();
    this.swarmGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.swarmGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.swarmGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    this.swarmMaterial = new THREE.ShaderMaterial({
      vertexShader: swarmVertSrc,
      fragmentShader: swarmFragSrc,
      transparent: true,
      depthWrite: false,
    });
    this.swarmPoints = new THREE.Points(this.swarmGeometry, this.swarmMaterial);
    this.swarmPoints.frustumCulled = false;
  }

  /**
   * Advance every satellite to the given simulation time. `simElapsedSeconds`
   * must be the server's `timeSeconds` (the same clock that drives planet
   * motion) so satellites respect Pause and the time-scale automatically.
   */
  update(simElapsedSeconds: number): void {
    for (let i = 0; i < this.majorOrbits.length; i++) {
      const o = this.majorOrbits[i]!;
      const angle = o.initialAngle + o.angularSpeed * simElapsedSeconds;
      const r = o.radius;
      this.dummy.position.set(r * Math.cos(angle), r * Math.sin(angle) * Math.sin(o.incRad), r * Math.sin(angle));
      this.dummy.scale.setScalar(this.majorScale);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.majorsMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.majorsMesh.instanceMatrix.needsUpdate = true;

    const n = this.swarmRadius.length;
    if (n > 0) {
      const attr = this.swarmGeometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < n; i++) {
        const angle = this.swarmAngle[i]! + this.swarmSpeed[i]! * simElapsedSeconds;
        const r = this.swarmRadius[i]!;
        arr[i * 3] = r * Math.cos(angle);
        arr[i * 3 + 1] = r * Math.sin(angle) * Math.sin(this.swarmInc[i]!);
        arr[i * 3 + 2] = r * Math.sin(angle);
      }
      attr.needsUpdate = true;
    }
  }

  /** Free all GPU resources. The caller owns detaching from the scene graph. */
  dispose(): void {
    this.majorsMesh.dispose(); // frees instanceMatrix / instanceColor buffers
    this.majorGeometry.dispose();
    this.majorMaterial.dispose();
    this.swarmGeometry.dispose();
    this.swarmMaterial.dispose();
  }
}
