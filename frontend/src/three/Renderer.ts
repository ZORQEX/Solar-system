import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import glowVert from "../shaders/glow.vert.glsl?raw";
import glowFrag from "../shaders/glow.frag.glsl?raw";
import starfieldVert from "../shaders/starfield.vert.glsl?raw";
import starfieldFrag from "../shaders/starfield.frag.glsl?raw";
import { bodyColor, displayRadius, isLuminous, toScene } from "./scaling.ts";
import type { BodyData } from "../shared.ts";

interface BodyEntry {
  mesh: THREE.Mesh;
  glow: THREE.Mesh | null;
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
  private readonly resize = () => this.handleResize();
  private readonly onClick = (e: MouseEvent) => this.handlePick(e);

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.001, 100000);
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
  }

  setOnSelect(cb: (id: string | null) => void): void {
    this.onSelect = cb;
  }

  /** Reconcile the scene with a fresh snapshot of bodies. */
  setBodies(bodies: BodyData[]): void {
    const seen = new Set<string>();
    for (const body of bodies) {
      seen.add(body.id);
      let entry = this.bodies.get(body.id);
      if (!entry) {
        entry = this.createEntry(body);
        this.bodies.set(body.id, entry);
        this.scene.add(entry.mesh);
      }
      entry.mesh.position.copy(toScene(body.position));
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
      this.controls.update();

      // Billboards: keep every glow facing the camera.
      for (const entry of this.bodies.values()) {
        if (entry.glow) entry.glow.quaternion.copy(this.camera.quaternion);
      }

      if (this.focusId) {
        const target = this.bodies.get(this.focusId);
        if (target) this.controls.target.lerp(target.mesh.position, 0.1);
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafHandle);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("click", this.onClick);
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

    const material = luminous
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1 });
    const mesh = new THREE.Mesh(this.sphereGeo, material);
    mesh.scale.setScalar(radius);
    mesh.userData.id = body.id;

    let glow: THREE.Mesh | null = null;
    if (luminous) {
      const glowMat = new THREE.ShaderMaterial({
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        uniforms: {
          uColor: { value: color.clone() },
          uIntensity: { value: 1.0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      glow = new THREE.Mesh(this.glowGeo, glowMat);
      glow.scale.setScalar(radius * 8);
      mesh.add(glow);
    }

    return { mesh, glow };
  }

  private disposeEntry(entry: BodyEntry): void {
    this.scene.remove(entry.mesh);
    // Geometry (sphereGeo/glowGeo) is shared and disposed in dispose(); only the
    // per-body materials are owned here.
    (entry.mesh.material as THREE.Material).dispose();
    if (entry.glow) (entry.glow.material as THREE.Material).dispose();
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
