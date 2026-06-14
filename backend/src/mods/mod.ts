import type { ForceField } from "../core/index.ts";
import type { Rng } from "../entities/random.ts";
import type { World } from "../simulation/world.ts";

/**
 * What a mod is handed on every hook: the authoritative world it may read and
 * mutate, and a seeded RNG so any randomness stays deterministic.
 *
 * (This is a type-only reference to `World`; mods are erased at runtime, so
 * there is no import cycle with the simulation layer.)
 */
export interface ModContext {
  world: World;
  rng: Rng;
}

/**
 * A mod extends the simulation without touching the core. It can install a
 * custom physics law (`forceField`) and/or react to the passage of time
 * (`onEvolve`). Built-in features like life evolution are themselves mods.
 */
export interface Mod {
  id: string;
  name: string;
  /** Extra acceleration applied to every body each step (a custom physics law). */
  forceField?: ForceField;
  /** Called once when the mod is registered. */
  onRegister?: (ctx: ModContext) => void;
  /** Called after each simulated span, with the elapsed simulated seconds. */
  onEvolve?: (ctx: ModContext, simSeconds: number) => void;
}
