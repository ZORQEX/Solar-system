import { test } from "node:test";
import assert from "node:assert/strict";
import { Body } from "../src/core/body.ts";
import { Vector3 } from "../src/core/vector3.ts";
import { OctreeNode } from "../src/core/octree.ts";
import {
  computeAccelerations,
  computeAccelerationsExact,
} from "../src/core/gravity.ts";

function body(id: string, x: number, y: number, z: number, mass: number): Body {
  return new Body({ id, mass, radius: 0, position: new Vector3(x, y, z) });
}

test("root aggregates total mass and center of mass", () => {
  const bodies = [
    body("a", -1, 0, 0, 2),
    body("b", 1, 0, 0, 2),
    body("c", 0, 3, 0, 4),
  ];
  const root = OctreeNode.build(bodies);

  assert.equal(root.mass, 8);
  const com = root.centerOfMass();
  // x: (2·-1 + 2·1 + 4·0)/8 = 0 ; y: (0 + 0 + 4·3)/8 = 1.5
  assert.ok(Math.abs(com.x - 0) < 1e-9);
  assert.ok(Math.abs(com.y - 1.5) < 1e-9);
  assert.ok(Math.abs(com.z - 0) < 1e-9);
});

test("near-coincident bodies fall into an overflow bucket without hanging", () => {
  const bodies = [
    body("a", 0, 0, 0, 1),
    body("b", 0, 0, 0, 1), // exactly coincident
  ];
  const root = OctreeNode.build(bodies);
  assert.equal(root.mass, 2);
  // Build terminates and mass is still correct — the key property.
});

function randomCluster(n: number, seed: number): Body[] {
  // Tiny deterministic LCG so the test is reproducible.
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const bodies: Body[] = [];
  for (let i = 0; i < n; i++) {
    bodies.push(
      body(
        `b${i}`,
        (rnd() - 0.5) * 100,
        (rnd() - 0.5) * 100,
        (rnd() - 0.5) * 100,
        rnd() * 10 + 1,
      ),
    );
  }
  return bodies;
}

test("Barnes–Hut matches exact gravity within the opening-angle tolerance", () => {
  const exactBodies = randomCluster(200, 42);
  const bhBodies = exactBodies.map((b) => b.toData()).map((d) => Body.fromData(d));

  const opts = { G: 1, theta: 0.4, softening: 0.5 };
  computeAccelerationsExact(exactBodies, opts);
  computeAccelerations(bhBodies, opts);

  let maxRelErr = 0;
  for (let i = 0; i < exactBodies.length; i++) {
    const exact = exactBodies[i]!.acceleration;
    const approx = bhBodies[i]!.acceleration;
    const err = exact.sub(approx).length() / Math.max(exact.length(), 1e-12);
    maxRelErr = Math.max(maxRelErr, err);
  }

  // With θ = 0.4 the per-body error should comfortably stay a few percent.
  assert.ok(
    maxRelErr < 0.05,
    `max relative acceleration error ${maxRelErr} should be < 0.05`,
  );
});

test("theta = 0 forces full expansion and reproduces exact gravity", () => {
  const a = randomCluster(60, 7);
  const b = a.map((x) => Body.fromData(x.toData()));

  computeAccelerationsExact(a, { G: 1, softening: 0.5 });
  computeAccelerations(b, { G: 1, theta: 0, softening: 0.5 });

  for (let i = 0; i < a.length; i++) {
    assert.ok(a[i]!.acceleration.sub(b[i]!.acceleration).length() < 1e-6);
  }
});
