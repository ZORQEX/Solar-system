import type { BodyData } from "../shared.ts";
import type { PredictionInput, PredictionOutput } from "../workers/messages.ts";

/**
 * Main-thread handle to the prediction worker. Falls back gracefully (
 * `available() === false`) where Web Workers aren't supported, so callers can
 * render server snapshots directly.
 */
export class Predictor {
  private worker: Worker | null = null;

  constructor(onFrame: (bodies: BodyData[]) => void) {
    try {
      this.worker = new Worker(
        new URL("../workers/prediction.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = (event: MessageEvent<PredictionOutput>) => {
        if (event.data.type === "predicted") onFrame(event.data.bodies);
      };
    } catch {
      this.worker = null;
    }
  }

  available(): boolean {
    return this.worker !== null;
  }

  /** Reset the predictor to an authoritative snapshot. */
  sync(bodies: BodyData[], timeScale: number, paused: boolean): void {
    this.post({ type: "sync", bodies, timeScale, paused });
  }

  /** Update playback (scale/pause) without resetting positions. */
  config(timeScale: number, paused: boolean): void {
    this.post({ type: "config", timeScale, paused });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private post(message: PredictionInput): void {
    this.worker?.postMessage(message);
  }
}
