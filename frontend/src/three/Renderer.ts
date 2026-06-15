import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import glowVert from "../shaders/glow.vert.glsl?raw";
import glowFrag from "../shaders/glow.frag.glsl?raw";
import starfieldVert from "../shaders/starfield.vert.glsl?raw";
import starfieldFrag from "../shaders/starfield.frag.glsl?raw";
import atmosphereVert from "../shaders/atmosphere.vert.glsl?raw";
import atmosphereFrag from "../shaders/atmosphere.frag.glsl?raw";
import cloudsVert from "../shaders/clouds.vert.glsl?raw";
import cloudsFragSrc from "../shaders/clouds.frag.glsl?raw";
import planetVert from "../shaders/planet.vert.glsl?raw";
import planetFragSrc from "../shaders/planet.frag.glsl?raw";
import noiseGLSL from "../shaders/noise.glsl?raw";
import { bodyColor, displayRadius, isLuminous, planetAppearance, toScene } from "./scaling.ts";
import type { BodyData } from "../shared.ts";

// Shaders that use procedural noise get the snoise/fbm library prepended.
const CLOUDS_FRAG = `${noiseGLSL}\n${cloudsFragSrc}`;
const PLANET_FRAG = `${noiseGLSL}\n${planetFragSrc}`;

/** Skip the cloud layer when the camera is farther than this (scene units). */
const CLOUD_LOD_DISTANCE = 500;

interface BodyEntry {
  mesh: THREE.Mesh;
  glow: THREE.Mesh | null;
  /** Fresnel atmosphere shell (BackSide, additive), if any. */
  atmosphere: THREE.Mesh | null;
  /** Procedural cloud shell, if any. */
  clouds: THREE.Mesh | null;
  /** True when the surface material is the sun-driven day/night shader. */
  terminator: boolean;
}

/**
 * Imperative Three.js scene manager, driven by snapshots. React owns the
 * canvas element; this owns everything inside it: camera, orbital controls,
 * one mesh per body (with a glow billboard for luminous bodies), a starfield
 * backdrop, and the animation loop.
 */
export class Renderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;

  private readonly sphereGeo = new THREE.SphereGeometry(1, 24, 16);
  private readonly glowGeo = new THREE.PlaneGeometry(1, 1);
  private readonly bodies = new Map<string, BodyEntry>();

  private focusId: string | null = null;
  private onSelect: ((id: string | null) => void) | null = null;
  private rafHandle = 0;
  private contextLost = false;
  /** World position of the brightest star, for day/night + cloud shading. */
  private readonly sunPosition = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly resize = () => this.handleResize();
  private readonly onClick = (e: MouseEvent) => this.handlePick(e);
  private readonly onContextLost = (e: Event) => {
    // Must preventDefault so the browser will attempt to restore the context.
    e.preventDefault();
    this.contextLost = true;
  };
  private readonly onContextRestored = () => {
    // Three.js re-uploads GPU resources automatically on the next render.
    this.contextLost = false;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // near is small enough to zoom up to a body, but not so small that the huge
    // far/near ratio wrecks depth precision; far covers the whole AU-scale scene.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100000);
    this.camera.position.set(3, 2, 3);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.scene.add(new THREE.AmbientLight(0x404050, 1.2));
    const sunLight = new THREE.PointLight(0xffffff, 2.5, 0, 0);
    this.scene.add(sunLight); // sits at the origin where the primary star is

    this.scene.add(this.makeStarfield(2000, 400));

    this.handleResize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("webglcontextlost", this.onContextLost as EventListener);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
  }

  setOnSelect(cb: (id: string | null) => void): void {
    this.onSelect = cb;
  }

  /** Reconcile the scene with a fresh snapshot of bodies. */
  setBodies(bodies: BodyData[]): void {
    const seen = new Set<string>();
    let brightestMass = -Infinity;
    for (const body of bodies) {
      seen.add(body.id);
      let entry = this.bodies.get(body.id);
      if (!entry) {
        entry = this.createEntry(body);
        this.bodies.set(body.id, entry);
        this.scene.add(entry.mesh);
      }
      // Guard against non-finite coordinates (e.g. a NaN from an unstable step):
      // hide the mesh rather than copying NaN into the scene graph, which would
      // make it un-cullable and could corrupt the camera target on focus.
      const p = toScene(body.position);
      const finite = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
      if (finite) {
        entry.mesh.position.copy(p);
        entry.mesh.visible = true;
        // Track the brightest star as the light source for shading.
        if (isLuminous(body) && body.mass > brightestMass) {
          brightestMass = body.mass;
          this.sunPosition.copy(p);
        }
      } else {
        entry.mesh.visible = false;
      }
    }
    for (const [id, entry] of this.bodies) {
      if (!seen.has(id)) {
        this.disposeEntry(entry);
        this.bodies.delete(id);
      }
    }
  }

  /** Smoothly keep the camera target on the selected body. */
  focus(id: string | null): void {
    this.focusId = id;
  }

  start(): void {
    const loop = () => {
      this.rafHandle = requestAnimationFrame(loop);
      // Don't touch GL while the context is lost; resume once restored.
      if (this.contextLost) return;
      this.controls.update();

      const time = performance.now() * 0.001;

      // Per-body per-frame updates: glow billboards, atmosphere/cloud shading,
      // cloud animation, and cloud LOD.
      for (const entry of this.bodies.values()) {
        if (entry.glow) entry.glow.quaternion.copy(this.camera.quaternion);

        if (entry.terminator || entry.clouds) {
          // Direction from this body toward the sun (world space).
          this.tmpDir.copy(this.sunPosition).sub(entry.mesh.position);
          if (this.tmpDir.lengthSq() === 0) this.tmpDir.set(1, 0, 0);
          else this.tmpDir.normalize();
        }

        if (entry.terminator) {
          const mat = entry.mesh.material as THREE.ShaderMaterial;
          mat.uniforms.sunDirection!.value.copy(this.tmpDir);
        }

        if (entry.clouds) {
          // LOD: drop the cloud shell when the camera is far away.
          const dist = this.camera.position.distanceTo(entry.mesh.position);
          entry.clouds.visible = dist < CLOUD_LOD_DISTANCE;
          if (entry.clouds.visible) {
            const cm = entry.clouds.material as THREE.ShaderMaterial;
            cm.uniforms.time!.value = time;
            cm.uniforms.sunDirection!.value.copy(this.tmpDir);
          }
        }
      }

      if (this.focusId) {
        const target = this.bodies.get(this.focusId);
        // Only chase a finite, visible target — never lerp toward NaN, which
        // would permanently break OrbitControls.
        if (target && target.mesh.visible) {
          this.controls.target.lerp(target.mesh.position, 0.1);
        }
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafHandle);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost as EventListener);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    for (const entry of this.bodies.values()) this.disposeEntry(entry);
    this.bodies.clear();
    this.sphereGeo.dispose();
    this.glowGeo.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // --- internals -----------------------------------------------------------

  private createEntry(body: BodyData): BodyEntry {
    const color = bodyColor(body);
    const radius = displayRadius(body);
    const luminous = isLuminous(body);
    const look = planetAppearance(body);

    // Surface material: stars glow flat; rocky worlds use the day/night
    // terminator shader; everything else is lit by the scene's point light.
    let material: THREE.Material;
    if (luminous) {
      material = new THREE.MeshBasicMaterial({ color });
    } else if (look.terminatorSurface) {
      material = new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: PLANET_FRAG,
        uniforms: {
          sunDirection: { value: new THREE.Vector3(1, 0, 0) },
          dayColor: { value: color.clone() },
          cityLights: { value: look.cityLights },
        },
      });
    } else {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1 });
    }
    const mesh = new THREE.Mesh(this.sphereGeo, material);
    mesh.scale.setScalar(radius);
    mesh.userData.id = body.id;

    // Star glow billboard (child scale is relative to the radius-scaled parent).
    let glow: THREE.Mesh | null = null;
    if (luminous) {
      const glowMat = new THREE.ShaderMaterial({
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        uniforms: { uColor: { value: color.clone() }, uIntensity: { value: 1.0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      glow = new THREE.Mesh(this.glowGeo, glowMat);
      glow.scale.setScalar(8); // ~8x the star radius
      mesh.add(glow);
    }

    // Atmosphere shell: a slightly larger BackSide sphere with a Fresnel rim.
    let atmosphere: THREE.Mesh | null = null;
    if (look.hasAtmosphere) {
      const atmMat = new THREE.ShaderMaterial({
        vertexShader: atmosphereVert,
        fragmentShader: atmosphereFrag,
        uniforms: {
          atmosphereColor: { value: new THREE.Color(...look.atmosphereColor) },
          intensity: { value: look.atmosphereIntensity },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      atmosphere = new THREE.Mesh(this.sphereGeo, atmMat);
      atmosphere.scale.setScalar(1.025);
      atmosphere.renderOrder = 3;
      mesh.add(atmosphere);
    }

    // Procedural cloud shell just above the surface.
    let clouds: THREE.Mesh | null = null;
    if (look.hasClouds && look.cloudOpacity > 0) {
      const cloudMat = new THREE.ShaderMaterial({
        vertexShader: cloudsVert,
        fragmentShader: CLOUDS_FRAG,
        uniforms: {
          time: { value: 0 },
          windSpeed: { value: 0.02 },
          cloudScale: { value: 3.0 },
          opacity: { value: look.cloudOpacity },
          cloudColor: { value: new THREE.Color(...look.cloudColor) },
          sunDirection: { value: new THREE.Vector3(1, 0, 0) },
        },
        transparent: true,
        depthWrite: false,
      });
      clouds = new THREE.Mesh(this.sphereGeo, cloudMat);
      clouds.scale.setScalar(1.01);
      clouds.renderOrder = 2;
      mesh.add(clouds);
    }

    return { mesh, glow, atmosphere, clouds, terminator: look.terminatorSurface };
  }

  private disposeEntry(entry: BodyEntry): void {
    // Removing the parent mesh removes its atmosphere/cloud/glow children too;
    // geometry (sphereGeo/glowGeo) is shared, so only per-body materials are
    // disposed here.
    this.scene.remove(entry.mesh);
    (entry.mesh.material as THREE.Material).dispose();
    if (entry.glow) (entry.glow.material as THREE.Material).dispose();
    if (entry.atmosphere) (entry.atmosphere.material as THREE.Material).dispose();
    if (entry.clouds) (entry.clouds.material as THREE.Material).dispose();
  }

  private makeStarfield(count: number, radius: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    const brightness = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Uniform direction on a sphere shell.
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = radius * s * Math.cos(phi);
      positions[i * 3 + 1] = radius * u;
      positions[i * 3 + 2] = radius * s * Math.sin(phi);
      brightness[i] = 0.3 + Math.random() * 0.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: starfieldVert,
      fragmentShader: starfieldFrag,
      uniforms: { uSize: { value: 2.5 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  }

  private handleResize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private handlePick(event: MouseEvent): void {
    if (!this.onSelect) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const meshes = [...this.bodies.values()].map((e) => e.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    this.onSelect((hit?.object.userData.id as string | undefined) ?? null);
  }
}
