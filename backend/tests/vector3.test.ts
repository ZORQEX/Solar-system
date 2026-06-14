import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "../src/core/vector3.ts";

test("add / sub / scale are element-wise and immutable", () => {
  const a = new Vector3(1, 2, 3);
  const b = new Vector3(4, 5, 6);

  assert.deepEqual(a.add(b).toJSON(), { x: 5, y: 7, z: 9 });
  assert.deepEqual(b.sub(a).toJSON(), { x: 3, y: 3, z: 3 });
  assert.deepEqual(a.scale(2).toJSON(), { x: 2, y: 4, z: 6 });

  // original untouched
  assert.deepEqual(a.toJSON(), { x: 1, y: 2, z: 3 });
});

test("dot and cross products", () => {
  const x = new Vector3(1, 0, 0);
  const y = new Vector3(0, 1, 0);

  assert.equal(x.dot(y), 0);
  assert.equal(x.dot(x), 1);
  // x × y = z (right-handed)
  assert.deepEqual(x.cross(y).toJSON(), { x: 0, y: 0, z: 1 });
});

test("length, distance and normalize", () => {
  const v = new Vector3(3, 4, 0);
  assert.equal(v.length(), 5);
  assert.equal(v.lengthSq(), 25);
  assert.equal(v.distance(new Vector3(0, 0, 0)), 5);

  const n = v.normalize();
  assert.ok(Math.abs(n.length() - 1) < 1e-12);
});

test("normalize of zero vector is the zero vector (no NaN)", () => {
  const z = Vector3.zero().normalize();
  assert.ok(z.isFinite());
  assert.deepEqual(z.toJSON(), { x: 0, y: 0, z: 0 });
});

test("from / toJSON round-trip", () => {
  const data = { x: -1.5, y: 2.25, z: 7 };
  assert.deepEqual(Vector3.from(data).toJSON(), data);
});
