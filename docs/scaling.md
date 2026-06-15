# Scaling & performance

## Spatial: Barnes–Hut

The force solver is O(N log N) via the Barnes–Hut octree, versus O(N²) for
all-pairs. The opening angle `θ` trades accuracy for speed:

| θ | Behaviour |
| --- | --- |
| `0` | Full expansion — identical to exact gravity (used in tests) |
| `0.5` (default) | A few-percent per-body error; the usual choice |
| `> 1` | Faster, visibly coarser |

The `generateStarCluster` generator ([`entities/generators.ts`](../backend/src/entities/generators.ts))
produces N-body scenarios for stress-testing the solver.

Collision detection is still O(N²) — the next optimization target is a uniform
spatial hash to gather candidate pairs.

## Temporal: multi-scale time

The hard problem in a universe sim is spanning **seconds to eons**. You cannot
integrate N-body gravity at a small `dt` across a billion years — that is ~10¹⁶
steps.

`Simulation.simulate(simSeconds)` ([`simulation/simulation.ts`](../backend/src/simulation/simulation.ts))
handles this:

- It splits a span into at most `maxSubstepsPerStep` physics substeps.
- Short spans use steps of `fixedDt` (accurate).
- Very long spans **stretch the step size** to cover the whole span in the step
  budget instead of running unboundedly many steps — fast reach, coarser orbits.
- The full span is always covered, so **entity time never desyncs** from physics
  time (stars age, life evolves over the true elapsed years even when orbital
  detail is sacrificed).

Named scales (`TIME_SCALES`, shared by client and server):

```
paused · realtime · minutes/s · hours/s · days/s · years/s
       · millennia/s · megayears/s · eons/s (gigayears)
```

At fast scales, orbital accuracy degrades by design; what matters there is
stellar evolution and life/civilization dynamics, which advance on the true
year count regardless of substep granularity.

## Determinism

Given the same initial scenario, config, `dt` sequence (and seed for mods), the
evolution is reproducible. The physics core uses no `Math.random()`; all
randomness flows through the seeded `Rng`
([`entities/random.ts`](../backend/src/entities/random.ts)). This is what makes
save/load + deterministic resume possible (see the save-load tests).

## Client-side acceleration (implemented)

- **Web Worker prediction** ([`frontend/src/workers/prediction.worker.ts`](../frontend/src/workers/prediction.worker.ts)):
  a predictive copy of the real physics engine runs in a worker and is resynced
  on every server snapshot, so motion stays smooth without the server losing
  authority. Toggle in the UI; graceful fallback when Workers are unavailable.
- **WebGPU N-body** ([`frontend/src/gpu/nbody-gpu.ts`](../frontend/src/gpu/nbody-gpu.ts)):
  an O(N²) force sum on the GPU via a WGSL compute shader, behind a capability
  check with an exact CPU fallback (same `NBodyAccelerator` interface). The Hud
  reports whether WebGPU is available.

## Future directions

- Spatial-hash collision broad-phase.
- Barnes–Hut tree on the GPU (vs. the current brute-force GPU path).
- Persistent multiplayer rooms.
