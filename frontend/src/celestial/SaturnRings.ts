import * as THREE from "three";
import ringVertSrc from "./shaders/saturn-rings.vert.glsl?raw";
import ringFragSrc from "./shaders/saturn-rings.frag.glsl?raw";
import { withNoise } from "./noise/index.ts";

/** Saturn's axial tilt — the ring plane is offset this far from the orbital plane. */
const AXIAL_TILT_RAD = THREE.MathUtils.degToRad(26.73);

// Annulus extent in units of Saturn's radius. 1.05 leaves a hair of margin
// inside the D ring (1.11 R); 2.40 clears the thin F ring (~2.33 R).
const INNER_R_MULT = 1.05;
const OUTER_R_MULT = 2.4;

/**
 * Procedural multi-band Saturn ring: a single flat annulus, no texture asset.
 * Bands (D/C/B/Cassini/A/F) are drawn entirely in the fragment shader from the
 * radius-as-a-multiple-of-R; see {@link ./shaders/saturn-rings.frag.glsl}.
 *
 * Meant to be added as a child of Saturn's group (inherits its position). Sized
 * from Saturn's runtime visual radius, never a hardcoded scene number.
 */
export class SaturnRings {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.RingGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor(saturnVisualRadius: number) {
    // Built in R-multiple units; mesh.scale applies the real radius.
    this.geometry = new THREE.RingGeometry(INNER_R_MULT, OUTER_R_MULT, 256, 8);
    this.material = new THREE.ShaderMaterial({
      vertexShader: ringVertSrc,
      fragmentShader: withNoise(ringFragSrc),
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false, // avoid z-fighting with Saturn + sorting vs. the swarm
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.setScalar(saturnVisualRadius);
    // RingGeometry lies in local XY (normal +Z). Lay it into the orbital plane
    // (scene XZ, since toScene swaps y/z) with -90° about X, then tip it by the
    // axial tilt about that same axis so the ring is 26.73° off the orbit plane.
    this.mesh.rotation.set(-Math.PI / 2 + AXIAL_TILT_RAD, 0, 0);
  }

  /** Free GPU resources. The caller owns detaching from the scene graph. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
