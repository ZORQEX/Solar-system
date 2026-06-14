import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  validateBodyData,
  validateClientMessage,
  validateScenario,
  validateVec3,
} from "../src/shared.ts";

const goodBody = {
  id: "p",
  type: "planet",
  mass: 1e24,
  radius: 6e6,
  position: { x: 1, y: 2, z: 3 },
  velocity: { x: 0, y: 0, z: 0 },
};

test("validateBodyData accepts a well-formed body and normalizes it", () => {
  const b = validateBodyData(goodBody);
  assert.equal(b.id, "p");
  assert.equal(b.type, "planet");
  assert.deepEqual(b.position, { x: 1, y: 2, z: 3 });
});

test("validateBodyData rejects bad input with ValidationError", () => {
  assert.throws(() => validateBodyData({ ...goodBody, id: "" }), ValidationError);
  assert.throws(() => validateBodyData({ ...goodBody, type: "dragon" }), ValidationError);
  assert.throws(() => validateBodyData({ ...goodBody, mass: -1 }), ValidationError);
  assert.throws(() => validateBodyData({ ...goodBody, mass: NaN }), ValidationError);
  assert.throws(() => validateBodyData({ ...goodBody, position: { x: 1, y: 2 } }), ValidationError);
  assert.throws(() => validateBodyData(null), ValidationError);
});

test("validateVec3 requires three finite components", () => {
  assert.deepEqual(validateVec3({ x: 1, y: 2, z: 3 }, "v"), { x: 1, y: 2, z: 3 });
  assert.throws(() => validateVec3({ x: 1, y: 2, z: Infinity }, "v"), ValidationError);
});

test("validateClientMessage handles every command type", () => {
  assert.deepEqual(validateClientMessage({ type: "pause" }), { type: "pause" });
  assert.deepEqual(validateClientMessage({ type: "setTimeScale", scale: 60 }), {
    type: "setTimeScale",
    scale: 60,
  });
  assert.equal(validateClientMessage({ type: "addBody", body: goodBody }).type, "addBody");
});

test("validateClientMessage rejects malformed commands", () => {
  assert.throws(() => validateClientMessage({ type: "setTimeScale", scale: -1 }), ValidationError);
  assert.throws(() => validateClientMessage({ type: "setTimeScale", scale: "fast" }), ValidationError);
  assert.throws(() => validateClientMessage({ type: "nope" }), ValidationError);
  assert.throws(() => validateClientMessage({ type: "addBody", body: { id: 5 } }), ValidationError);
});

test("validateScenario validates each body", () => {
  const ok = validateScenario({ name: "s", bodies: [goodBody] });
  assert.equal(ok.bodies.length, 1);
  assert.throws(() => validateScenario({ name: "s", bodies: "no" }), ValidationError);
  assert.throws(() => validateScenario({ bodies: [goodBody] }), ValidationError); // no name
});
