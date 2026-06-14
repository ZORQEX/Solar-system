# Modding

A **mod** extends the simulation without touching the core. It can install a
custom physics law and/or react to the passage of time. Built-in features (life
evolution) are themselves mods.

## The `Mod` interface

From [`mods/mod.ts`](../backend/src/mods/mod.ts):

```ts
interface ModContext {
  world: World;   // the authoritative world — read and mutate it
  rng: Rng;       // seeded RNG so any randomness stays deterministic
}

interface Mod {
  id: string;
  name: string;
  /** Custom physics law: extra acceleration (m/s²) on a body, on top of gravity. */
  forceField?: (body: Body, bodies: readonly Body[]) => Vector3;
  /** Called once when registered. */
  onRegister?: (ctx: ModContext) => void;
  /** Called after each simulated span, with the elapsed simulated seconds. */
  onEvolve?: (ctx: ModContext, simSeconds: number) => void;
}
```

## Registering a mod

```ts
import { Simulation } from "../backend/src/simulation/index.ts";
import { createLifeMod, createDragMod } from "../backend/src/mods/index.ts";

const sim = Simulation.fromSeed(2049, { seed: 2049 });
sim.use(createLifeMod());      // life & civilization evolution
sim.use(createDragMod(1e-9));  // a custom physics law
```

`use()` installs the `forceField` on the engine immediately and fires
`onEvolve` on every subsequent `simulate()` span. The mod RNG is seeded from the
simulation's `seed` option.

## Custom physics law (`forceField`)

A force field returns the *extra* acceleration applied to each body each step.
Examples from [`mods/examples.ts`](../backend/src/mods/examples.ts):

```ts
// Linear velocity drag: a = -k·v  (bleeds energy out)
export function createDragMod(k: number): Mod {
  return { id: "example.drag", name: "drag",
           forceField: (body) => body.velocity.scale(-k) };
}

// Toy cosmological expansion: a = H²·r  (bodies drift apart)
export function createExpansionMod(H: number): Mod {
  const h2 = H * H;
  return { id: "example.expansion", name: "expansion",
           forceField: (body) => body.position.scale(h2) };
}
```

The engine applies all registered fields additively after gravity, through a
single `recompute()` hook, so custom laws are never skipped (initial step,
integrator substeps, and post-merge refresh).

## Custom rules (`onEvolve`)

`onEvolve` runs after physics each span — the place for slow, non-gravitational
dynamics. The built-in life mod ([`mods/life-mod.ts`](../backend/src/mods/life-mod.ts))
is just:

```ts
export function createLifeMod(): Mod {
  return {
    id: "core.life",
    name: "Life & Civilization Evolution",
    onEvolve(ctx, simSeconds) {
      advanceLife(ctx.world, simSeconds / SECONDS_PER_YEAR, ctx.rng);
    },
  };
}
```

A rule mod can do anything with `ctx.world`: spawn bodies, tweak entities, enact
diplomacy between civilizations, trigger events. Use `ctx.rng` (not
`Math.random()`) so the run stays deterministic and reproducible across
save/load.

## A complete example mod

```ts
import type { Mod } from "../backend/src/mods/index.ts";

// Every ~10 Myr, a random star goes supernova: convert it to a black hole.
export function createSupernovaMod(): Mod {
  return {
    id: "demo.supernova",
    name: "Supernovae",
    onEvolve(ctx, simSeconds) {
      const years = simSeconds / 3.15576e7;
      const p = 1 - Math.exp(-years / 1e7);
      for (const star of ctx.world.stars.values()) {
        if (star.massSolar > 8 && ctx.rng.next() < p) {
          star.ageYears = star.mainSequenceLifetimeYears * 1.2; // force collapse
        }
      }
    },
  };
}
```
