import { Vector3 } from "./vector3.ts";
import { OctreeNode } from "./octree.ts";
import type { Body } from "./body.ts";
import { DEFAULT_SOFTENING, DEFAULT_THETA, G as DEFAULT_G } from "../shared.ts";

export interface GravityOptions {
  /** Gravitational constant. */
  G?: number;
  /** Barnes–Hut opening angle θ. Treat a node as one mass when size/dist < θ. */
  theta?: number;
  /** Plummer softening length ε (metres). */
  softening?: number;
}

interface ResolvedGravity {
  G: number;
  thetaSq: number;
  softeningSq: number;
}

function resolve(opts: GravityOptions | undefined): ResolvedGravity {
  const theta = opts?.theta ?? DEFAULT_THETA;
  const softening = opts?.softening ?? DEFAULT_SOFTENING;
  return {
    G: opts?.G ?? DEFAULT_G,
    thetaSq: theta * theta,
    softeningSq: softening * softening,
  };
}

/**
 * Accumulate the acceleration on `target` from a single point mass at `srcX/Y/Z`
 * into the running totals `out`. Uses Plummer softening so the result stays
 * finite as separation → 0.
 */
function addPointAccel(
  target: Body,
  srcX: number,
  srcY: number,
  srcZ: number,
  srcMass: number,
  G: number,
  softeningSq: number,
  out: [number, number, number],
): void {
  const dx = srcX - target.position.x;
  const dy = srcY - target.position.y;
  const dz = srcZ - target.position.z;
  const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
  // a = G·m·r / |r|³  (with softened |r|)
  const invDist = 1 / Math.sqrt(distSq);
  const factor = (G * srcMass * invDist * invDist) * invDist;
  out[0] += dx * factor;
  out[1] += dy * factor;
  out[2] += dz * factor;
}

function accumulate(
  node: OctreeNode,
  target: Body,
  cfg: ResolvedGravity,
  out: [number, number, number],
): void {
  if (node.mass === 0) return;

  // Leaf: a single body — exact pairwise contribution (skip self).
  if (node.body !== null) {
    if (node.body === target) return;
    const p = node.body.position;
    addPointAccel(target, p.x, p.y, p.z, node.body.mass, cfg.G, cfg.softeningSq, out);
    return;
  }

  // Near-coincident bodies kept together: treat each pairwise.
  if (node.overflow !== null) {
    for (const b of node.overflow) {
      if (b === target) continue;
      const p = b.position;
      addPointAccel(target, p.x, p.y, p.z, b.mass, cfg.G, cfg.softeningSq, out);
    }
    return;
  }

  // Internal node: open it, or approximate it by its center of mass.
  const com = node.centerOfMass();
  const dx = com.x - target.position.x;
  const dy = com.y - target.position.y;
  const dz = com.z - target.position.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const width = node.halfWidth * 2;

  // Opening criterion: (s / d) < θ  ⇔  s² < θ²·d².
  if (width * width < cfg.thetaSq * distSq) {
    addPointAccel(target, com.x, com.y, com.z, node.mass, cfg.G, cfg.softeningSq, out);
    return;
  }

  const children = node.children;
  if (children !== null) {
    for (const child of children) {
      if (child !== null) accumulate(child, target, cfg, out);
    }
  }
}

/**
 * Compute and store the gravitational acceleration on every alive body, using a
 * freshly built Barnes–Hut octree. Writes into each `body.acceleration`.
 * Cost ≈ O(N log N).
 */
export function computeAccelerations(
  bodies: readonly Body[],
  options?: GravityOptions,
): void {
  const cfg = resolve(options);
  const root = OctreeNode.build(bodies);
  for (const target of bodies) {
    if (!target.alive) continue;
    const out: [number, number, number] = [0, 0, 0];
    accumulate(root, target, cfg, out);
    target.acceleration = new Vector3(out[0], out[1], out[2]);
  }
}

/**
 * Exact all-pairs acceleration, O(N²). Slower but approximation-free — used as
 * the ground truth that Barnes–Hut accuracy tests compare against.
 */
export function computeAccelerationsExact(
  bodies: readonly Body[],
  options?: GravityOptions,
): void {
  const cfg = resolve(options);
  for (const target of bodies) {
    if (!target.alive) continue;
    const out: [number, number, number] = [0, 0, 0];
    for (const src of bodies) {
      if (src === target || !src.alive) continue;
      const p = src.position;
      addPointAccel(target, p.x, p.y, p.z, src.mass, cfg.G, cfg.softeningSq, out);
    }
    target.acceleration = new Vector3(out[0], out[1], out[2]);
  }
}
