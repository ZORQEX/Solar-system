import * as THREE from "three";
import asteroidVertSrc from "./shaders/asteroid.vert.glsl?raw";
import asteroidFragSrc from "./shaders/asteroid.frag.glsl?raw";
import { withNoise } from "./noise/index.ts";
import type { AsteroidVisual, CelestialObject } from "./types.ts";

const ASTEROID_VERT = withNoise(asteroidVertSrc);

/** Distance (scene units) beyond which a single asteroid is hidden. */
const ASTEROID_MAX_DISTANCE = 300;

/**
 * A single lumpy body (used for comets / lone asteroids). Rendered through a
 * 1-instance InstancedMesh so it can share the instanced asteroid shader with
 * {@link AsteroidBelt}. The factory sets `object3D.position`; the instance
 * matrix only carries the radius scale.
 */
export class ProceduralAsteroid implements CelestialObject {
  readonly object3D: THREE.InstancedMesh;
  private readonly geometry: THREE.IcosahedronGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor(visual: AsteroidVisual) {
    this.geometry = new THREE.IcosahedronGeometry(1, 3);
    this.geometry.setAttribute(
      "aSeed",
      new THREE.InstancedBufferAttribute(new Float32Array([visual.seed]), 1),
    );

    this.material = new THREE.ShaderMaterial({
      vertexShader: ASTEROID_VERT,
      fragmentShader: asteroidFragSrc,
      uniforms: {
        uAmplitude: { value: visual.amplitude },
        uPeriod: { value: 0.6 },
        uColor: { value: visual.color.clone() },
        uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
        uAmbient: { value: 0.08 },
      },
    });

    this.object3D = new THREE.InstancedMesh(this.geometry, this.material, 1);
    this.object3D.frustumCulled = false; // shader displacement exceeds geometry bounds
    const scale = new THREE.Matrix4().makeScale(visual.radius, visual.radius, visual.radius);
    this.object3D.setMatrixAt(0, scale);
    this.object3D.instanceMatrix.needsUpdate = true;
  }

  update(_dt: number, sunPosition: THREE.Vector3, cameraDistance: number): void {
    (this.material.uniforms.uSunPosition!.value as THREE.Vector3).copy(sunPosition);
    this.object3D.visible = cameraDistance < ASTEROID_MAX_DISTANCE;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.object3D.dispose();
  }
}
