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
npm test                 # run backend core tests (Node built-in runner)
npm run demo             # run the mini solar-system demo
npm run typecheck        # tsc --noEmit across workspaces
```

## Status

Implemented: `shared` constants/types, `backend/src/core` physics engine + tests,
solar-system demo. Not yet: entities, simulation scheduler, AI, API, frontend.
