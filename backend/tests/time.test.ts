import { test } from "node:test";
import assert from "node:assert/strict";
import { TimeController, TIME_SCALES } from "../src/simulation/index.ts";
import { SECONDS_PER_YEAR } from "../src/shared.ts";

test("scale maps real time to simulated time", () => {
  const tc = new TimeController(3600); // 1 real second = 1 sim hour
  assert.equal(tc.simDeltaForReal(2), 7200);
});

test("pause freezes simulated time", () => {
  const tc = new TimeController(1000);
  tc.pause();
  assert.equal(tc.simDeltaForReal(5), 0);
  tc.resume();
  assert.equal(tc.simDeltaForReal(5), 5000);
  tc.togglePause();
  assert.equal(tc.paused, true);
});

test("named scales resolve to the right factor", () => {
  const tc = new TimeController();
  tc.setScaleByName("years/s");
  assert.equal(tc.scale, SECONDS_PER_YEAR);
  tc.setScaleByName("eons/s");
  assert.equal(tc.scale, TIME_SCALES["eons/s"]);
  assert.equal(TIME_SCALES.paused, 0);
});

test("setScale clamps negatives to zero", () => {
  const tc = new TimeController();
  tc.setScale(-100);
  assert.equal(tc.scale, 0);
});
