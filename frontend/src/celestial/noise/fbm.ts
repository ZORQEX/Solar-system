/**
 * Fractal noise built on `simplex3`, ported from the reference:
 *  - `fractal3`      — fractional Brownian motion (octave sum), normalized.
 *  - `terrainHeight` — dispatch over simplex / fractal (billowy) / ridged,
 *                      returning a non-negative height. This is the heart of
 *                      the surface displacement + colour banding.
 *  - `cloudFbm`      — a [0,1] fbm used by the cloud shell.
 *
 * Requires `SIMPLEX3_GLSL` to be prepended first (see ./index).
 */
export const FBM_GLSL = /* glsl */ `
float fractal3(
  vec3 v,
  float sharpness,
  float period,
  float persistence,
  float lacunarity,
  int octaves
) {
  float n = 0.0;
  float a = 1.0;        // amplitude for current octave
  float max_amp = 0.0;  // accumulate to normalize afterwards
  float P = period;     // period for current octave
  for (int i = 0; i < 32; i++) {
    if (i >= octaves) { break; } // dynamic loop bound (GLSL ES 1.0 needs const max)
    n += a * simplex3(v / P);
    max_amp += a;        // include this octave before reducing → result ~[-1, 1]
    a *= persistence;
    P /= lacunarity;
  }
  return n / max(max_amp, 1e-5);
}

float terrainHeight(
  int type,
  vec3 v,
  float amplitude,
  float sharpness,
  float offset,
  float period,
  float persistence,
  float lacunarity,
  int octaves
) {
  // Shape the noise into [0, ~1] FIRST, then apply amplitude exactly once.
  // (Applying amplitude before the shaping — as the reference does at its
  // radius-20 scale — collapses the range to a near-constant when amplitude is
  // small, as it is here, giving flat featureless planets.)
  float shaped = 0.0;
  if (type == 1) {
    shaped = simplex3(v / period) * 0.5 + 0.5;                          // [0, 1]
  } else if (type == 2) {
    float n = fractal3(v, sharpness, period, persistence, lacunarity, octaves);
    shaped = pow(max(0.0, (n + 1.0) * 0.5), sharpness);                 // billowy
  } else if (type == 3) {
    float n = fractal3(v, sharpness, period, persistence, lacunarity, octaves);
    shaped = pow(max(0.0, 1.0 - abs(n)), sharpness);                    // ridged
  }
  return max(0.0, amplitude * shaped + offset);
}

// Cloud coverage in [0, 1] from a few octaves of simplex.
float cloudFbm(vec3 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amp * simplex3(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return clamp(value * 0.5 + 0.5, 0.0, 1.0);
}
`;
