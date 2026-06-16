import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import starfieldVert from "../shaders/starfield.vert.glsl?raw";
import starfieldFrag from "../shaders/starfield.frag.glsl?raw";
import { isLuminous, toScene } from "./scaling.ts";
import { CelestialFactory } from "../celestial/index.ts";
import type { BodyData } from "../shared.ts";

/**
 * Imperative Three.js scene manager. React owns the canvas element; this owns
 * the scene, camera, orbital controls, starfield backdrop, lights and the
 * single animation loop. Body meshes themselves are owned entirely by the
 * {@link CelestialFactory}, which is the only thing that adds them to the scene.
 */
export class Renderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly factory: CelestialFactory;

  /** Latest snapshot; the factory updates positions/shaders from it each frame. */
  private latestBodies: BodyData[] = [];
  /** Scene-space position of the brightest star (light source for shading). */
  private readonly sunPosition = new THREE.Vector3();

  private focusId: string | null = null;
  /** Latest simulation time (server `timeSeconds`); drives decorative satellites. */
  private simTimeSeconds = 0;
  private onSelect: ((id: string | null) => void) | null = null;
  private rafHandle = 0;
  private contextLost = false;
  private lastFrameAt = performance.now();
  private readonly resize = () => this.handleResize();
  private readonly onClick = (e: MouseEvent) => this.handlePick(e);
  private readonly onContextLost = (e: Event) => {
    e.preventDefault(); // required so the browser attempts to restore the context
    this.contextLost = true;
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // near small enough to zoom up to a body, far covering the AU-scale scene.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100000);
    this.camera.position.set(3, 2, 3);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.scene.add(new THREE.AmbientLight(0x404050, 1.2));
    this.scene.add(new THREE.PointLight(0xffffff, 2.5, 0, 0)); // at origin (primary star)
    this.scene.add(this.makeStarfield(2000, 400));

    this.factory = new CelestialFactory(this.scene);

    this.handleResize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("webglcontextlost", this.onContextLost as EventListener);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
  }

  setOnSelect(cb: (id: string | null) => void): void {
    this.onSelect = cb;
  }

  /** Hand a fresh snapshot to the factory and refresh the sun position. */
  setBodies(bodies: BodyData[]): void {
    this.latestBodies = bodies;
    this.factory.sync(bodies);

    let brightest = -Infinity;
    for (const body of bodies) {
      if (!isLuminous(body) || body.mass <= brightest) continue;
      const p = toScene(body.position);
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
        brightest = body.mass;
        this.sunPosition.copy(p);
      }
    }
  }

  /** Smoothly keep the camera target on the selected body. */
  focus(id: string | null): void {
    this.focusId = id;
  }

  /**
   * Current simulation time in seconds (the server's authoritative `timeSeconds`).
   * Decorative satellites advance from this, so they respect Pause and the
   * time-scale exactly like the rest of the simulation.
   */
  setSimTime(seconds: number): void {
    this.simTimeSeconds = seconds;
  }

  start(): void {
    const loop = () => {
      this.rafHandle = requestAnimationFrame(loop);
      if (this.contextLost) return; // don't touch GL while the context is lost

      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastFrameAt) / 1000);
      this.lastFrameAt = now;

      this.controls.update();

      // All per-body per-frame work lives in the factory (single RAF loop).
      this.factory.update(this.latestBodies, this.sunPosition, this.camera.position, dt, this.simTimeSeconds);

      if (this.focusId) {
        const body = this.latestBodies.find((b) => b.id === this.focusId);
        if (body) {
          const p = toScene(body.position);
          if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
            this.controls.target.lerp(p, 0.1);
          }
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
    this.factory.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // --- internals -----------------------------------------------------------

  private makeStarfield(count: number, radius: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    const brightness = new Float32Array(count);
    for (let i = 0; i < count; i++) {
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
    const hit = raycaster.intersectObjects(this.factory.pickables(), false)[0];
    this.onSelect((hit?.object.userData.id as string | undefined) ?? null);
  }
}
