// Time scales are defined in the shared package so client and server agree.
import { TIME_SCALES, type TimeScaleName } from "../shared.ts";
export { TIME_SCALES, type TimeScaleName };

/**
 * Controls how wall-clock time maps to simulated time. Holds the current scale
 * (sim seconds / real second) and a pause flag.
 */
export class TimeController {
  /** Simulated seconds elapsed per real second. */
  scale: number;
  paused: boolean;

  constructor(scale: number = TIME_SCALES.realtime, paused = false) {
    this.scale = scale;
    this.paused = paused;
  }

  setScale(scale: number): void {
    this.scale = Math.max(0, scale);
  }

  setScaleByName(name: TimeScaleName): void {
    this.scale = TIME_SCALES[name];
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  /** Simulated seconds to advance for a given real-time delta. */
  simDeltaForReal(realDeltaSeconds: number): number {
    if (this.paused) return 0;
    return this.scale * realDeltaSeconds;
  }
}
