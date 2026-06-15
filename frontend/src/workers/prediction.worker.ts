/**
 * Client-side prediction worker. It runs a *predictive copy* of the authoritative
 * physics (the real backend engine, bundled by Vite) so motion stays smooth
 * between server snapshots. The server remains the source of truth: every
 * snapshot resyncs this engine, correcting any drift.
 *
 * Collisions are disabled here — merges are the server's call; the predictor only
 * smooths motion, so the body set must stay stable between syncs.
 */
import { PhysicsEngine, Body } from "../../../backend/src/core/index.ts";
import type { PredictionInput, PredictionOutput } from "./messages.ts";

// Avoid pulling the conflicting DOM `self` typing into this worker module.
const ctx = self as unknown as {
  postMessage: (message: PredictionOutput) => void;
  onmessage: ((event: MessageEvent<PredictionInput>) => void) | null;
};

const FIXED_DT = 3600; // 1 hour
const MAX_SUBSTEPS = 64;
const FRAME_MS = 33; // ~30 Hz

let engine: PhysicsEngine | null = null;
let timeScale = 1;
let paused = false;
let lastAt = performance.now();

ctx.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === "sync") {
    engine = new PhysicsEngine(msg.bodies.map(Body.fromData), { collisions: false });
    timeScale = msg.timeScale;
    paused = msg.paused;
    lastAt = performance.now(); // avoid a big catch-up step right after a resync
  } else if (msg.type === "config") {
    timeScale = msg.timeScale;
    paused = msg.paused;
  }
};

setInterval(() => {
  const now = performance.now();
  const realDt = (now - lastAt) / 1000;
  lastAt = now;
  if (!engine || paused || timeScale <= 0) return;

  // Clamp the integrated span so dt never exceeds FIXED_DT — mirrors the
  // server's stable-dt rule, so prediction can't fling bodies off screen at a
  // huge time scale (a resync from the next snapshot keeps it authoritative).
  const simSeconds = Math.min(realDt * timeScale, MAX_SUBSTEPS * FIXED_DT);
  const steps = Math.max(1, Math.ceil(simSeconds / FIXED_DT));
  const dt = simSeconds / steps;
  for (let i = 0; i < steps; i++) engine.step(dt);

  ctx.postMessage({ type: "predicted", bodies: engine.snapshot() });
}, FRAME_MS);
