# Universe Simulator 2049 — Documentation

Reference docs for how the simulator is built and how to extend it.

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Module layout, dependency direction, data flow client ↔ server |
| [physics.md](physics.md) | The physics: softened gravity, Barnes–Hut, Velocity-Verlet, collisions, conservation |
| [api.md](api.md) | REST endpoints and the WebSocket wire protocol |
| [scaling.md](scaling.md) | Performance characteristics and the multi-scale time model |
| [modding.md](modding.md) | Writing mods: custom physics laws (`forceField`) and rules (`onEvolve`) |

See the root [ARCHITECTURE.md](../ARCHITECTURE.md) for the project contract/conventions and
[README.md](../README.md) for quick-start commands.

## TL;DR

- **Backend** (`backend/`, Node ≥ 23.6, native TypeScript) owns the authoritative
  world: physics core → entities → simulation scheduler → REST/WebSocket server.
- **Frontend** (`frontend/`, React + Three.js + Vite) renders interpolated
  snapshots streamed over WebSocket and sends commands back.
- **Shared** (`shared/`) holds SI constants, entity/protocol types, time scales,
  and runtime validators used by both sides.
- Everything in the physics core is **deterministic** and **side-effect free**;
  all randomness is seeded.
