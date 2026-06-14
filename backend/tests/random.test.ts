import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/entities/random.ts";

test("same seed reproduces the same sequence", () => {
  const a = new Rng(12345);
  const b = new Rng(12345);
  for (let i = 0; i < 1000; i++) {
    assert.equal(a.next(), b.next());
  }
});

test("different seeds diverge", () => {
  const a = new Rng(1);
  const b = new Rng(2);
  let same = 0;
  for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
  assert.ok(same < 5, "sequences should not coincide");
});

test("next() stays in [0, 1)", () => {
  const r = new Rng(7);
  for (let i = 0; i < 10000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
  }
});

test("int() respects inclusive bounds", () => {
  const r = new Rng(99);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 5000; i++) {
    const n = r.int(3, 6);
    assert.ok(Number.isInteger(n));
    min = Math.min(min, n);
    max = Math.max(max, n);
  }
  assert.equal(min, 3);
  assert.equal(max, 6);
});

test("gaussian is roughly centred on its mean", () => {
  const r = new Rng(42);
  let sum = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) sum += r.gaussian(10, 2);
  const mean = sum / n;
  assert.ok(Math.abs(mean - 10) < 0.1, `mean ${mean} should be ≈ 10`);
});
