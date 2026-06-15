# Universe Simulator 2049

A multithreaded universe simulator: realistic N-body physics, procedural worlds,
emergent civilizations, multi-scale time, and a real-time 3D frontend — running in
the browser with a Node.js authoritative server.

This file is the contract for how the codebase is organized, how physics is
computed, and the style every module must follow. Read it before editing.

---

## Architecture

```
universe-sim-2049/
├── shared/          # Types, constants, wire protocol shared by client + server
├── backend/         # Node.js + TypeScript authoritative simulation + API
│   └── src/
│       ├── core/         # Physics engine (N-body, Barnes-Hut, integrators, collisions)
│       ├── entities/     # Stars, planets, black holes, life, civilizations
│       ├── simulation/   # Multi-scale time, world state, scenario loading
│       ├── ai/           # Lightweight behavior nets for entities
│       └── api/          # REST + WebSocket
├── frontend/        # React + Three.js + WebGPU + Web Workers
├── data/            # Initial scenarios (solar system, Andromeda, ...)
├── docs/            # Architecture, scaling, physics formulas
└── scripts/         # World generators, benchmarks, demos
```

### Data flow
1. The **backend** owns authoritative world state and advances it with the
   `PhysicsEngine` (see `backend/src/core`).
2. State deltas are broadcast over WebSocket using the protocol in `shared`.
3. The **frontend** renders interpolated state and may run a *predictive* copy of
   the physics in Web Workers for smoothness; the server is always authoritative.

---

## Physics (the core, build this first)

We simulate gravitational N-body dynamics.

- **Force:** Newtonian gravity with Plummer softening to avoid singularities:

  ```
  a_i = G * Σ_j  m_j * (r_j - r_i) / (|r_j - r_i|² + ε²)^(3/2)
  ```

  `ε` (softening length) prevents infinite acceleration when bodies get close.

- **Approximation:** Barnes–Hut octree. A node of width `s` at distance `d` from
  the target body is treated as a single mass at its center-of-mass when
  `s / d < θ` (opening angle, default `θ = 0.5`). Cost ~ `O(N log N)` instead of
  `O(N²)`.

- **Integrator:** Velocity Verlet (a.k.a. leapfrog kick-drift-kick). Chosen because
  it is symplectic — bounded energy error over long runs, unlike naive Euler:

  ```
  v += ½ a(t)  dt          (kick)
  x += v       dt          (drift)
  recompute a(t+dt)
  v += ½ a(t+dt) dt        (kick)
  ```

- **Collisions:** when `|r_i - r_j| < R_i + R_j`, bodies merge. Mass and momentum
  are conserved; new radius from summed volume (uniform-density assumption).

- **Units:** SI internally (kg, m, s). `shared/src/constants.ts` provides `G`,
  `AU`, `SOLAR_MASS`, etc. Tests often use `G = 1` natural units for clarity.

### Invariants the tests guard
- Total momentum is conserved by gravity steps and by merges.
- Total energy (kinetic + softened potential) drifts < ~1% over a closed orbit.
- A circular two-body orbit stays bounded near its initial radius.

---

## Conventions

- **Language:** TypeScript, ES modules, `strict` mode. No `enum`, no `namespace`
  (they don't survive Node's native type-stripping) — use union types and `const`
  objects instead.
- **Imports:** relative imports include the `.ts` extension so files run natively
  under Node ≥ 23.6 (`node file.ts`) with no build step.
- **Vectors:** `Vector3` is an immutable value type — methods return new vectors,
  they never mutate. Hot loops that need mutation use the explicit `*Mut` helpers.
- **Determinism:** the engine must be deterministic for a fixed scenario + dt.
  No `Math.random()` inside `core/` — randomness lives in generators under
  `scripts/` and `entities/` and is always seeded.
- **Tests:** `node:test` + `node:assert/strict`. Files end in `.test.ts`. No test
  framework dependency. Run `npm test`.
- **Style:** small pure functions in `core/`; side effects (sockets, logging) stay
  out of the engine.

---

## Commands

```bash
npm test                 # run backend tests (Node built-in runner)
npm run demo             # mini solar-system demo (orbits + energy conservation)
npm run demo:life        # watch life + a civilization emerge over billions of years
npm run serve            # start the authoritative REST + WebSocket server
npm run frontend         # start the Vite dev server (3D client)
npm run build:frontend   # production build of the client
npm run typecheck        # tsc --noEmit (backend)
npm run typecheck:frontend
```

## Status

All five modules implemented, tested (70 backend tests, typecheck + `vite build`
green):

1. `backend/src/core` — Barnes–Hut N-body physics, Velocity-Verlet, collisions,
   pluggable force fields.
2. `backend/src/entities` — seeded RNG, stars (evolution), planets
   (habitability), life/civilization types, procedural generators.
3. `backend/src/simulation` — multi-scale time, world state, scheduler,
   save/load, mod hooks.
4. `backend/src/api` — authoritative REST + WebSocket server.
5. `backend/src/ai` + `backend/src/mods` — neural nets, life/civilization
   evolution, and a mod system (custom physics laws + rules).
6. `frontend/` — React + Three.js client (orbital camera, shaders, live snapshots,
   selected-body details, save/load, observer presence, Web Worker prediction,
   WebGPU N-body accelerator).

Also implemented: structured logging + `/api/metrics`, optional token auth
(REST + WebSocket), input validation at the server boundary, multiplayer
presence, extra scenarios (binary star, asteroid belt, galaxy, figure-eight),
and Docker/compose deployment. See `docs/` for details.

Future directions: spatial-hash collision broad-phase, Barnes–Hut on the GPU,
richer civilization/diplomacy models, persistent multiplayer rooms.
