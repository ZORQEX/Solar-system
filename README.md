# Universe Simulator 2049

A multithreaded universe simulator — realistic N-body physics, procedural worlds,
emergent civilizations, multi-scale time, and a real-time 3D frontend — with a
Node.js authoritative server.

> Status: **all five modules implemented and tested** — physics core, entities,
> simulation scheduler, REST + WebSocket server, AI/civilization evolution + mod
> system, and a React + Three.js client. 70 backend tests; `vite build` green.

## Quick start

Requires **Node ≥ 23.6** (the backend runs TypeScript natively — no build step).

```bash
npm install
npm test            # backend test suite (Node built-in runner)
npm run demo        # simulate one year of the solar system
npm run demo:life   # watch life + a civilization emerge over billions of years
npm run serve       # start the authoritative REST + WebSocket server (port 8080)
npm run frontend    # start the 3D client (Vite dev server, port 5173)
npm run typecheck   # tsc --noEmit
```

Run `npm run serve` and `npm run frontend` together, then open the client to
watch the universe live.

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
| `shared/` | Physical constants (SI), entity/protocol types, time scales — shared by client + server |
| `backend/src/core/` | Physics engine: `Vector3`, `Body`, Barnes–Hut `Octree`, softened gravity, Velocity-Verlet integrator, collisions/merges, pluggable force fields |
| `backend/src/entities/` | Seeded RNG, `Star` (evolution), `Planet` (habitability), life/civilization types, procedural generators |
| `backend/src/simulation/` | Multi-scale time, `World` state, `Simulation` scheduler, save/load, mod hooks |
| `backend/src/api/` | Authoritative REST + WebSocket `UniverseServer` |
| `backend/src/ai/` | Neural networks + life/civilization evolution model |
| `backend/src/mods/` | Mod system: life mod + example custom physics laws |
| `frontend/` | React + Three.js client (orbital camera, GLSL shaders, Zustand store) |
| `backend/tests/` | 70 tests: conservation laws, orbit stability, octree accuracy, evolution, server, mods |
| `scripts/` | World generators + runnable demos + server entrypoint |
| `data/` | Generated scenarios (e.g. `solar-system.json`) |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the architecture, physics formulas, and conventions.

## Physics in one paragraph

Bodies attract via softened Newtonian gravity, approximated with a Barnes–Hut
octree (`O(N log N)`) and advanced by a symplectic Velocity-Verlet integrator, so
total energy stays bounded over long runs. Overlapping bodies merge while
conserving mass and momentum. Everything in `core/` is deterministic and
side-effect free.

## Author

Created and maintained by **ZORQEX**.

## License

Released under the [MIT License](LICENSE) — © 2026 ZORQEX.
