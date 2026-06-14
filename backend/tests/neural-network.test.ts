import { test } from "node:test";
import assert from "node:assert/strict";
import { NeuralNetwork } from "../src/ai/index.ts";
import { Rng } from "../src/entities/index.ts";

test("same seed builds an identical network", () => {
  const a = NeuralNetwork.random([3, 5, 2], new Rng(7));
  const b = NeuralNetwork.random([3, 5, 2], new Rng(7));
  const input = [0.1, -0.2, 0.3];
  assert.deepEqual(a.forward(input), b.forward(input));
});

test("forward output has the right shape and tanh range", () => {
  const net = NeuralNetwork.random([4, 6, 3], new Rng(1));
  const out = net.forward([1, 2, 3, 4]);
  assert.equal(out.length, 3);
  for (const v of out) assert.ok(v > -1 && v < 1, `tanh output out of range: ${v}`);
});

test("wrong input length throws", () => {
  const net = NeuralNetwork.random([2, 2], new Rng(1));
  assert.throws(() => net.forward([1, 2, 3]));
});

test("toJSON / fromJSON preserves behaviour", () => {
  const net = NeuralNetwork.random([3, 4, 2], new Rng(99));
  const clone = NeuralNetwork.fromJSON(JSON.parse(JSON.stringify(net.toJSON())));
  const input = [0.5, -0.5, 0.25];
  assert.deepEqual(clone.forward(input), net.forward(input));
});

test("mutate at rate 0 is a no-op; at rate 1 it changes", () => {
  const net = NeuralNetwork.random([2, 3, 1], new Rng(3));
  const input = [0.4, 0.6];

  const unchanged = net.mutate(new Rng(5), 0);
  assert.deepEqual(unchanged.forward(input), net.forward(input));

  const changed = net.mutate(new Rng(5), 1, 0.5);
  assert.notDeepEqual(changed.forward(input), net.forward(input));
});
