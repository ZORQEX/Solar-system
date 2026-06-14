# Architecture

## Module layout

```
shared/                  Types, SI constants, time scales, wire protocol, validators
backend/src/
  core/                  Physics engine — N-body, Barnes–Hut, integrator, collisions
  entities/              Stars, planets, life/civilization types, seeded generators
  simulation/            Multi-scale time, World state, Simulation scheduler, save/load
  api/                   Authoritative REST + WebSocket server
  ai/                    Neural networks + life/civilization evolution model
  mods/                  Mod system: built-in life mod + example physics laws
frontend/src/            React + Three.js client (scene, store, components, shaders)
scripts/                 Generators, demos, server entrypoint
data/                    Generated scenarios (JSON)
```

## Dependency direction

Dependencies point strictly downward; there are no cycles.

```
core  ──▶ shared
entities ──▶ core, shared
ai ──▶ entities, shared                 (pure functions; no simulation import)
simulation ──▶ core, entities, shared
            └▶ ai  (only the built-in life mod bridges them)
mods ──▶ core, ai, shared
      └▶ type-only ref to simulation's World (erased at runtime, no cycle)
api ──▶ simulation, core, shared
frontend ──▶ shared (types/protocol/validators), bundled by Vite
```

Key rule: **`ai/` never imports `simulation/`**. The life model operates on a
structural `LifeWorld` interface (the four entity maps), which `World` satisfies
without a hard dependency. Mods reference `World` only as a *type* (`import
type`), so native ESM erases it and no runtime cycle forms.

## Data flow

1. The server holds one authoritative `Simulation` (`world` + physics + mods).
2. A real-time loop (`UniverseServer.start()`) advances it each tick and
   broadcasts a `snapshot` to every connected WebSocket client.
3. Clients render interpolated snapshots and send `ClientMessage` commands
   (pause, time scale, add body) back; the server validates, applies, and
   re-broadcasts.
4. REST offers out-of-band operations: health, current state, and save/load.

```
            ┌─────────────────────── server (authoritative) ──────────────────────┐
            │  Simulation ─ World ─ PhysicsEngine (+forceFields)                    │
            │       │           └ stars / planets / biospheres / civilizations      │
 commands   │       └ mods (life, custom laws)                                       │
 ─────────▶ │  WebSocket  ◀── snapshots ──▶  REST (/api/health,/state,/save,/load)  │
            └───────────────────────────────────────────────────────────────────────┘
                 ▲                                   │ snapshots
                 │ ClientMessage                     ▼
            ┌──────────────────────── client (one per observer) ───────────────────┐
            │  Connection → Zustand store → Three.js Renderer + React UI            │
            └───────────────────────────────────────────────────────────────────────┘
```

## Why native TypeScript, no build (backend)

Relative imports keep the `.ts` extension, so Node ≥ 23.6 runs the source
directly (`node file.ts`) via type-stripping. That means:

- no enums or namespaces (they don't survive stripping) — use union types and
  `const` objects;
- a single bridge file per package (`backend/src/shared.ts`,
  `frontend/src/shared.ts`) re-exports `shared/` so cross-package paths are
  centralized;
- tests run on the built-in `node --test` runner with zero test-framework deps.

The frontend is bundled by Vite, which also resolves the `.ts` imports and the
`?raw` GLSL shader imports.
