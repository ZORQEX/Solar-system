import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from "../shared.ts";

/**
 * Named time scales, expressed as **simulated seconds per real second**. These
 * let a user fly from watching orbits in real time to watching stars live and
 * die over billions of years. The physics integrator caps how large a step it
 * will actually take, so picking a fast scale trades accuracy for reach.
 */
export const TIME_SCALES = {
  paused: 0,
  realtime: 1,
  "minutes/s": 60,
  "hours/s": 3600,
  "days/s": SECONDS_PER_DAY,
  "years/s": SECONDS_PER_YEAR,
  "millennia/s": 1e3 * SECONDS_PER_YEAR,
  "megayears/s": 1e6 * SECONDS_PER_YEAR,
  "eons/s": 1e9 * SECONDS_PER_YEAR, // gigayears
} as const;

export type TimeScaleName = keyof typeof TIME_SCALES;

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
