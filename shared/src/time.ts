import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from "./constants.ts";

/**
 * Named time scales, expressed as **simulated seconds per real second**. Shared
 * by the server (which advances the world) and clients (which present a speed
 * selector), so the two never drift out of sync on what "years/s" means.
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
