import { test } from "node:test";
import assert from "node:assert/strict";
import { Body } from "../src/core/body.ts";
import { Vector3 } from "../src/core/vector3.ts";
import {
  isColliding,
  merge,
  resolveCollisions,
} from "../src/core/collisions.ts";
import { totalMomentum } from "../src/core/energy.ts";

function b(id: string, mass: number, x: number, vx: number, radius: number): Body {
  return new Body({
    id,
    mass,
    radius,
    position: new Vector3(x, 0, 0),
    velocity: new Vector3(vx, 0, 0),
  });
}

test("isColliding compares separation to summed radii", () => {
  const a = b("a", 1, 0, 0, 1);
  const c = b("c", 1, 1.5, 0, 1); // sep 1.5 < 2 -> overlap
  const d = b("d", 1, 3, 0, 1); // sep 3 > 2 -> clear
  assert.equal(isColliding(a, c), true);
  assert.equal(isColliding(a, d), false);
});

test("merge conserves mass and momentum and combines volume", () => {
  const a = b("a", 2, 0, 1, 1);
  const c = b("c", 3, 1, -1, 1);
  const pBefore = totalMomentum([a, c]);

  merge(a, c);

  assert.equal(c.alive, false);
  assert.equal(a.mass, 5);
  // momentum: 2·1 + 3·(-1) = -1  → v = -0.2
  assert.ok(Math.abs(a.velocity.x - -0.2) < 1e-12);
  // center of mass: (2·0 + 3·1)/5 = 0.6
  assert.ok(Math.abs(a.position.x - 0.6) < 1e-12);
  // radius from summed volume: (1³ + 1³)^(1/3)
  assert.ok(Math.abs(a.radius - Math.cbrt(2)) < 1e-12);
  // identity follows the heavier body
  assert.equal(a.id, "c");

  const pAfter = totalMomentum([a, c]);
  assert.ok(pAfter.sub(pBefore).length() < 1e-12);
});

test("resolveCollisions handles a chain of overlaps in one pass", () => {
  // Three bodies each overlapping the next: all collapse into one.
  const bodies = [
    b("a", 1, 0, 0, 1),
    b("b", 1, 1, 0, 1),
    b("c", 1, 2, 0, 1),
  ];
  const massBefore = bodies.reduce((s, x) => s + x.mass, 0);

  const removed = resolveCollisions(bodies);

  const alive = bodies.filter((x) => x.alive);
  assert.equal(alive.length, 1);
  assert.equal(removed, 2);
  assert.equal(alive[0]!.mass, massBefore); // mass conserved
});
