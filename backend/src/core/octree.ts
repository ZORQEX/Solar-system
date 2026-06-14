import { Vector3 } from "./vector3.ts";
import type { Body } from "./body.ts";

/**
 * Hard cap on subdivision depth. Two bodies at (nearly) the same position would
 * otherwise recurse forever; past this depth we keep them together in a single
 * node's `overflow` bucket and treat them pairwise.
 */
const MAX_DEPTH = 64;

/**
 * One cubic cell of a Barnes–Hut octree.
 *
 * A node is in exactly one of three states:
 *  - empty:    `mass === 0`
 *  - leaf:     holds a single `body`
 *  - internal: has up to 8 `children`
 *
 * Every node also caches the total mass and the mass-weighted position sum of
 * the bodies beneath it, so a distant clump can be approximated by one mass at
 * its center of mass.
 */
export class OctreeNode {
  readonly center: Vector3;
  /** Half the cube's edge length. The cube spans center ± halfWidth per axis. */
  readonly halfWidth: number;

  mass = 0;
  /** Mass-weighted position sum; center of mass = this / mass. */
  private comSumX = 0;
  private comSumY = 0;
  private comSumZ = 0;

  body: Body | null = null;
  children: Array<OctreeNode | null> | null = null;
  /** Bodies that could not be separated before MAX_DEPTH (near-coincident). */
  overflow: Body[] | null = null;

  constructor(center: Vector3, halfWidth: number) {
    this.center = center;
    this.halfWidth = halfWidth;
  }

  /** Center of mass of everything beneath this node. */
  centerOfMass(): Vector3 {
    if (this.mass === 0) return this.center;
    return new Vector3(
      this.comSumX / this.mass,
      this.comSumY / this.mass,
      this.comSumZ / this.mass,
    );
  }

  insert(body: Body, depth = 0): void {
    // Aggregate mass/COM contribution for every node on the path down.
    this.mass += body.mass;
    this.comSumX += body.mass * body.position.x;
    this.comSumY += body.mass * body.position.y;
    this.comSumZ += body.mass * body.position.z;

    if (this.overflow !== null) {
      this.overflow.push(body);
      return;
    }

    if (this.children !== null) {
      this.insertIntoChild(body, depth);
      return;
    }

    if (this.body === null) {
      // Empty leaf becomes occupied.
      this.body = body;
      return;
    }

    // Occupied leaf: subdivide and push both bodies down.
    const existing = this.body;
    this.body = null;

    if (depth >= MAX_DEPTH) {
      this.overflow = [existing, body];
      return;
    }

    this.children = new Array<OctreeNode | null>(8).fill(null);
    this.insertIntoChild(existing, depth);
    this.insertIntoChild(body, depth);
  }

  private insertIntoChild(body: Body, depth: number): void {
    const idx = this.childIndex(body.position);
    const children = this.children!;
    let child = children[idx];
    if (child === undefined || child === null) {
      child = new OctreeNode(this.childCenter(idx), this.halfWidth / 2);
      children[idx] = child;
    }
    child.insert(body, depth + 1);
  }

  /** Octant index in [0, 8): bit0 = +x, bit1 = +y, bit2 = +z. */
  private childIndex(p: Vector3): number {
    let idx = 0;
    if (p.x >= this.center.x) idx |= 1;
    if (p.y >= this.center.y) idx |= 2;
    if (p.z >= this.center.z) idx |= 4;
    return idx;
  }

  private childCenter(idx: number): Vector3 {
    const h = this.halfWidth / 2;
    return new Vector3(
      this.center.x + ((idx & 1) !== 0 ? h : -h),
      this.center.y + ((idx & 2) !== 0 ? h : -h),
      this.center.z + ((idx & 4) !== 0 ? h : -h),
    );
  }

  /**
   * Build an octree spanning all alive bodies. The root cube is the smallest
   * cube enclosing them, padded slightly so points never sit exactly on a face.
   */
  static build(bodies: readonly Body[]): OctreeNode {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    let count = 0;
    for (const b of bodies) {
      if (!b.alive) continue;
      count++;
      const p = b.position;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }

    if (count === 0) {
      return new OctreeNode(Vector3.zero(), 1);
    }

    const center = new Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    );
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    // Guard the degenerate (all-coincident / single body) case.
    const halfWidth = Math.max(extent / 2, 1) * 1.0001;

    const root = new OctreeNode(center, halfWidth);
    for (const b of bodies) {
      if (b.alive) root.insert(b);
    }
    return root;
  }
}
