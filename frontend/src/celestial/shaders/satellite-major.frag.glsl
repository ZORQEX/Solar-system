// Matte surface for a major satellite, tinted by the per-instance colour.
// Lambert diffuse only (no specular). The primary star sits at the scene
// origin, so the light direction is simply toward the origin — decorative, no
// per-frame sun uniform needed. Requires the noise library (cloudFbm) prepended.
varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vTint;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(-vWorldPos); // toward the sun (≈ scene origin)
  float diff = max(dot(N, L), 0.0);

  // Subtle surface mottle so the body doesn't read as a flat-shaded ball.
  float mottle = 0.8 + 0.4 * cloudFbm(vLocalPos * 5.0);
  float light = 0.1 + 0.95 * diff; // ambient + matte diffuse

  gl_FragColor = vec4(vTint * light * mottle, 1.0);
}
