import type { BodyData } from "../shared.ts";

/** Main thread → prediction worker. */
export type PredictionInput =
  | { type: "sync"; bodies: BodyData[]; timeScale: number; paused: boolean }
  | { type: "config"; timeScale: number; paused: boolean };

/** Prediction worker → main thread. */
export type PredictionOutput = { type: "predicted"; bodies: BodyData[] };
