// Cloud shell fragment shader. Procedural fbm coverage on a sphere just above
// the surface, animated by wind (time) and shaded by the sun. Requires the
// noise library (cloudFbm) prepended.
uniform float uTime;
uniform float uWindSpeed;
uniform float uCloudScale;
uniform float uOpacity;
uniform vec3 uCloudColor;
uniform vec3 uSunPosition;
uniform vec3 uSeed;

varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 p = normalize(vLocalPos) * uCloudScale + uSeed + vec3(uTime * uWindSpeed);
  float n = cloudFbm(p);
  float coverage = smoothstep(0.45, 0.65, n);
  float a = coverage * uOpacity;
  if (a < 0.01) discard;

  vec3 L = normalize(uSunPosition - vWorldPos);
  float lit = 0.2 + 0.8 * clamp(dot(normalize(vWorldNormal), L), 0.0, 1.0);
  gl_FragColor = vec4(uCloudColor * lit, a);
}
