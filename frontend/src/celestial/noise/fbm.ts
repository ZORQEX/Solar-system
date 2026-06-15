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
    a *= persistence;
    max_amp += a;
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
  float h = 0.0;
  if (type == 1) {
    h = amplitude * simplex3(v / period);
  } else if (type == 2) {
    h = amplitude * fractal3(v, sharpness, period, persistence, lacunarity, octaves);
    h = amplitude * pow(max(0.0, (h + 1.0) / 2.0), sharpness);
  } else if (type == 3) {
    h = fractal3(v, sharpness, period, persistence, lacunarity, octaves);
    h = amplitude * pow(max(0.0, 1.0 - abs(h)), sharpness);
  }
  return max(0.0, h + offset);
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
