# Universe Simulator 2049

A multithreaded universe simulator — realistic N-body physics, procedural worlds,
emergent civilizations, multi-scale time, and a real-time 3D frontend — with a
Node.js authoritative server.

> Status: **core physics engine** implemented and tested. Entities, simulation
> scheduler, AI, networking API, and the Three.js frontend are next.

## Quick start

Requires **Node ≥ 23.6** (the project runs TypeScript natively — no build step).

```bash
npm install
npm test          # backend core test suite (Node built-in runner)
npm run demo      # simulate one year of the solar system
npm run typecheck # tsc --noEmit
```

### Demo output

```
  month   Earth–Sun (AU)
    6.0   0.999957
   12.0   0.999994
--- summary ---
Earth orbit  : 1.0000–1.0000 AU
energy drift : 1.30e-6 %
```

## What's here

| Path | Contents |
| --- | --- |
| `shared/` | Physical constants (SI) and types shared by client + server |
| `backend/src/core/` | The physics engine: `Vector3`, `Body`, Barnes–Hut `Octree`, softened gravity, Velocity-Verlet integrator, collisions/merges, `PhysicsEngine` |
| `backend/tests/` | Energy/momentum conservation, orbit stability, octree accuracy, collisions |
| `scripts/` | World generators + runnable demo |
| `data/` | Generated scenarios (e.g. `solar-system.json`) |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the architecture, physics formulas, and conventions.

## Physics in one paragraph

Bodies attract via softened Newtonian gravity, approximated with a Barnes–Hut
octree (`O(N log N)`) and advanced by a symplectic Velocity-Verlet integrator, so
total energy stays bounded over long runs. Overlapping bodies merge while
conserving mass and momentum. Everything in `core/` is deterministic and
side-effect free.
