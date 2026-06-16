// Saturn ring fragment shader. `r` is the radius as a multiple of Saturn's own
// radius. Bands (D, C, B, Cassini gap, A, F) are selected by smoothstep windows
// (~2% blend at each boundary, no hard cuts) and composited by opacity-weighted
// average so boundaries cross-fade. A subtle fbm multiply adds within-band
// texture (±8% brightness). Requires the noise library (cloudFbm) prepended.
varying vec2 vRingPos;

void main() {
  float r = length(vRingPos);
  float e = 0.02; // boundary blend half-width, in units of R

  // Band membership weights in [0,1]; adjacent bands cross-fade at their edges.
  float bD = smoothstep(1.11 - e, 1.11 + e, r) * (1.0 - smoothstep(1.24 - e, 1.24 + e, r));
  float bC = smoothstep(1.24 - e, 1.24 + e, r) * (1.0 - smoothstep(1.53 - e, 1.53 + e, r));
  float bB = smoothstep(1.53 - e, 1.53 + e, r) * (1.0 - smoothstep(1.95 - e, 1.95 + e, r));
  float bGap = smoothstep(1.95 - e, 1.95 + e, r) * (1.0 - smoothstep(1.99 - e, 1.99 + e, r)); // Cassini
  float bA = smoothstep(1.99 - e, 1.99 + e, r) * (1.0 - smoothstep(2.27 - e, 2.27 + e, r));
  float bF = smoothstep(2.31 - e, 2.31 + e, r) * (1.0 - smoothstep(2.35 - e, 2.35 + e, r)); // thin F

  // Band colours.
  const vec3 cD = vec3(0.784, 0.722, 0.604);   // #c8b89a
  const vec3 cC = vec3(0.722, 0.659, 0.533);   // #b8a888
  const vec3 cB = vec3(0.878, 0.831, 0.690);   // #e0d4b0
  const vec3 cGap = vec3(0.20, 0.18, 0.15);    // dark Cassini Division
  const vec3 cA = vec3(0.831, 0.753, 0.596);   // #d4c098
  const vec3 cF = vec3(0.847, 0.816, 0.753);   // #d8d0c0

  // Per-band base opacity.
  float a = bD * 0.15 + bC * 0.35 + bB * 0.85 + bGap * 0.05 + bA * 0.65 + bF * 0.10;
  vec3 col = bD * 0.15 * cD + bC * 0.35 * cC + bB * 0.85 * cB
           + bGap * 0.05 * cGap + bA * 0.65 * cA + bF * 0.10 * cF;
  col = a > 1e-4 ? col / a : vec3(0.0); // opacity-weighted average colour

  // Within-band texture: fbm brightness ripple ±8%.
  float n = cloudFbm(vec3(vRingPos * 6.0, r * 3.0));
  col *= 1.0 + (n - 0.5) * 0.16;

  if (a < 0.01) discard; // gaps + outside the ring system
  gl_FragColor = vec4(col, a);
}
