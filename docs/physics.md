# Physics

All quantities are SI internally (kg, m, s). Constants live in
[`shared/src/constants.ts`](../shared/src/constants.ts). Tests often use natural
units (`G = 1`) for clarity.

## Gravity (softened Newtonian)

Acceleration on body *i* from all others *j*, with Plummer softening `ε` to keep
the force finite at small separations:

```
a_i = G · Σ_j  m_j · (r_j − r_i) / (|r_j − r_i|² + ε²)^(3/2)
```

`ε` (`softening`) is roughly the resolution floor of the simulation. Without it,
near-coincident bodies would produce singular accelerations.

Implemented in [`core/gravity.ts`](../backend/src/core/gravity.ts):
`computeAccelerations` (Barnes–Hut) and `computeAccelerationsExact` (the O(N²)
ground truth used by accuracy tests).

## Barnes–Hut approximation

An octree ([`core/octree.ts`](../backend/src/core/octree.ts)) groups distant
bodies. A node of width `s` seen from distance `d` is treated as a single mass at
its center of mass when

```
s / d < θ            (θ = opening angle, default 0.5)
```

Cost drops from O(N²) to ~O(N log N). `θ = 0` forces full expansion and
reproduces exact gravity; larger `θ` is faster but coarser. Near-coincident
bodies that cannot be separated before the depth cap share an `overflow` bucket
and are handled pairwise.

## Integrator (Velocity Verlet)

A symplectic kick–drift–kick step ([`core/integrator.ts`](../backend/src/core/integrator.ts)):

```
v += ½ a(t)   · dt        (kick)
x += v        · dt        (drift)
recompute a(t + dt)
v += ½ a(t+dt)· dt        (kick)
```

Symplectic integrators keep total energy *bounded* over long runs instead of
drifting the way explicit Euler does. Precondition: `a(t)` is valid at entry;
the engine recomputes it lazily on the first step and after any merge.

## Collisions / merges

When two spheres overlap (`|r_i − r_j| < R_i + R_j`) they merge
([`core/collisions.ts`](../backend/src/core/collisions.ts)), conserving mass and
linear momentum:

```
m   = m_i + m_j
v   = (m_i·v_i + m_j·v_j) / m          (center-of-mass velocity)
x   = (m_i·x_i + m_j·x_j) / m          (center of mass)
R   = (R_i³ + R_j³)^(1/3)              (summed volume, uniform density)
```

The surviving body adopts the identity of the more significant one (mass, then
type rank). Detection is currently O(N²) — the obvious spot for a spatial hash.

## Custom force laws

The engine applies registered `ForceField` functions additively on top of
gravity each step (see [modding.md](modding.md)). This is how mods add drag, a
cosmological expansion term, or any other law without touching the core.

## Conservation invariants (guarded by tests)

- **Momentum** is conserved by gravity steps (exact, `θ = 0`) and by merges.
- **Energy** (kinetic + softened potential) drifts < ~1 % over a closed orbit;
  the solar-system demo shows ~10⁻⁶ % over one year.
- A circular two-body orbit stays bounded near its initial radius.

Energy/momentum diagnostics: [`core/energy.ts`](../backend/src/core/energy.ts).
The softened potential consistent with the force above is

```
U = −G · Σ_{i<j}  m_i·m_j / √(r_ij² + ε²)
```
