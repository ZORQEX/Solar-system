import { advanceLife } from "../ai/index.ts";
import { SECONDS_PER_YEAR } from "../shared.ts";
import type { Mod } from "./mod.ts";

/**
 * Built-in mod that drives life and civilization evolution. It delegates to the
 * AI module's `advanceLife`, converting the elapsed simulated time to years.
 * Register it on a simulation to make biospheres develop and civilizations rise.
 */
export function createLifeMod(): Mod {
  return {
    id: "core.life",
    name: "Life & Civilization Evolution",
    onEvolve(ctx, simSeconds) {
      advanceLife(ctx.world, simSeconds / SECONDS_PER_YEAR, ctx.rng);
    },
  };
}
