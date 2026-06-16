import * as THREE from "three";
import planetVertSrc from "./shaders/planet.vert.glsl?raw";
import planetFragSrc from "./shaders/planet.frag.glsl?raw";
import atmosphereFragSrc from "./shaders/atmosphere.frag.glsl?raw";
import cloudsFragSrc from "./shaders/clouds.frag.glsl?raw";
import { withNoise } from "./noise/index.ts";
import type { CelestialObject, PlanetVisual } from "./types.ts";

// Shared shell vertex shader (atmosphere + clouds). Provides every varying any
// consuming fragment needs; size comes from each child mesh's own scale.
const SHELL_VERT = /* glsl */ `
varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec3 vViewNormal;
varying vec3 vViewPos;
void main() {
  vLocalPos = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const PLANET_VERT = withNoise(planetVertSrc);
const PLANET_FRAG = withNoise(planetFragSrc);
const CLOUDS_FRAG = withNoise(cloudsFragSrc);

// LOD thresholds in scene units (1 AU = 1 unit; planets are ~0.05–0.18 units).
const LOD_HIGH_DISTANCE = 6; // closer than this → high-detail geometry
const CLOUD_MAX_DISTANCE = 40; // farther than this → hide clouds
const ATMOSPHERE_MAX_DISTANCE = 120; // farther than this → hide atmosphere

const v3 = (value: THREE.Vector3): THREE.Vector3 => value; // readability helper

export class ProceduralPlanet implements CelestialObject {
  readonly object3D: THREE.Mesh;

  private readonly highGeometry: THREE.SphereGeometry;
  private readonly lowGeometry: THREE.SphereGeometry;
  private readonly shellGeometry: THREE.SphereGeometry;
  private readonly planetMaterial: THREE.ShaderMaterial;
  private readonly atmosphere: THREE.Mesh | null = null;
  private readonly atmosphereMaterial: THREE.ShaderMaterial | null = null;
  private readonly clouds: THREE.Mesh | null = null;
  private readonly cloudMaterial: THREE.ShaderMaterial | null = null;
  private cloudTime = 0;

  constructor(visual: PlanetVisual) {
    this.highGeometry = new THREE.SphereGeometry(1, 96, 96);
    this.highGeometry.computeTangents();
    this.lowGeometry = new THREE.SphereGeometry(1, 24, 24);
    this.lowGeometry.computeTangents();
    this.shellGeometry = new THREE.SphereGeometry(1, 48, 32);

    this.planetMaterial = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: this.buildPlanetUniforms(visual),
    });

    this.object3D = new THREE.Mesh(this.highGeometry, this.planetMaterial);

    if (visual.atmosphereIntensity > 0) {
      this.atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: atmosphereFragSrc,
        uniforms: {
          uAtmosphereColor: { value: visual.atmosphereColor.clone() },
          uIntensity: { value: visual.atmosphereIntensity },
          uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.atmosphere = new THREE.Mesh(this.shellGeometry, this.atmosphereMaterial);
      this.atmosphere.scale.setScalar(visual.radius * 1.18);
      this.atmosphere.renderOrder = 3;
      this.object3D.add(this.atmosphere);
    }

    if (visual.cloudOpacity > 0) {
      this.cloudMaterial = new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: CLOUDS_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uWindSpeed: { value: 0.02 },
          uCloudScale: { value: 2.5 },
          uOpacity: { value: visual.cloudOpacity },
          uCloudColor: { value: visual.cloudColor.clone() },
          uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
          uSeed: { value: visual.seed.clone() },
        },
        transparent: true,
        depthWrite: false,
      });
      this.clouds = new THREE.Mesh(this.shellGeometry, this.cloudMaterial);
      this.clouds.scale.setScalar(visual.radius * 1.04);
      this.clouds.renderOrder = 2;
      this.object3D.add(this.clouds);
    }
  }

  update(dt: number, sunPosition: THREE.Vector3, cameraDistance: number): void {
    v3(this.planetMaterial.uniforms.uSunPosition!.value as THREE.Vector3).copy(sunPosition);

    // LOD: swap surface geometry detail by distance.
    const wantHigh = cameraDistance < LOD_HIGH_DISTANCE;
    const target = wantHigh ? this.highGeometry : this.lowGeometry;
    if (this.object3D.geometry !== target) this.object3D.geometry = target;

    if (this.atmosphere && this.atmosphereMaterial) {
      this.atmosphere.visible = cameraDistance < ATMOSPHERE_MAX_DISTANCE;
      v3(this.atmosphereMaterial.uniforms.uSunPosition!.value as THREE.Vector3).copy(sunPosition);
    }

    if (this.clouds && this.cloudMaterial) {
      const visible = cameraDistance < CLOUD_MAX_DISTANCE;
      this.clouds.visible = visible;
      if (visible) {
        this.cloudTime += dt;
        this.cloudMaterial.uniforms.uTime!.value = this.cloudTime;
        v3(this.cloudMaterial.uniforms.uSunPosition!.value as THREE.Vector3).copy(sunPosition);
        this.clouds.rotation.y += dt * 0.02; // slow drift, as in the reference
      }
    }
  }

  dispose(): void {
    // Geometry/materials are owned exclusively by this object; the factory owns
    // removing object3D from the scene.
    this.highGeometry.dispose();
    this.lowGeometry.dispose();
    this.shellGeometry.dispose();
    this.planetMaterial.dispose();
    this.atmosphereMaterial?.dispose();
    this.cloudMaterial?.dispose();
  }

  private buildPlanetUniforms(visual: PlanetVisual): Record<string, THREE.IUniform> {
    const t = visual.terrain;
    const p = visual.palette;
    return {
      uType: { value: t.type },
      uRadius: { value: visual.radius },
      uAmplitude: { value: t.amplitude },
      uSharpness: { value: t.sharpness },
      uOffset: { value: t.offset },
      uPeriod: { value: t.period },
      uPersistence: { value: t.persistence },
      uLacunarity: { value: t.lacunarity },
      uOctaves: { value: t.octaves },
      uSeed: { value: visual.seed.clone() },
      uColor1: { value: p.colors[0].clone() },
      uColor2: { value: p.colors[1].clone() },
      uColor3: { value: p.colors[2].clone() },
      uColor4: { value: p.colors[3].clone() },
      uColor5: { value: p.colors[4].clone() },
      uTransition2: { value: p.transitions[0] },
      uTransition3: { value: p.transitions[1] },
      uTransition4: { value: p.transitions[2] },
      uTransition5: { value: p.transitions[3] },
      uBlend12: { value: p.blends[0] },
      uBlend23: { value: p.blends[1] },
      uBlend34: { value: p.blends[2] },
      uBlend45: { value: p.blends[3] },
      uBumpStrength: { value: 0.7 },
      uBumpOffset: { value: 0.002 },
      uAmbient: { value: 0.05 },
      uDiffuse: { value: 1.0 },
      uSpecular: { value: 0.5 },
      uShininess: { value: 16.0 },
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uBanded: { value: visual.banded ? 1 : 0 },
      uBandFreq: { value: visual.bandFreq },
      uPolarCaps: { value: visual.polarCaps },
      uSpotColor: { value: visual.spotColor.clone() },
      uSpotDir: { value: visual.spotDir.clone() },
      uSpotStrength: { value: visual.spotStrength },
      uSpotSize: { value: visual.spotSize },
    };
  }
}
