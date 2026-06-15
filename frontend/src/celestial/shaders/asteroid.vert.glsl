// Asteroid vertex shader. Lumpy displacement of a unit sphere via simplex +
// ridged noise, seeded per instance (aSeed) so every rock differs. Always
// rendered through an InstancedMesh (count 1 for a single body), so it uses
// `instanceMatrix`. Requires the noise library (simplex3) prepended.
attribute float aSeed;

uniform float uAmplitude;
uniform float uPeriod;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vHeight;

void main() {
  vec3 seed = vec3(aSeed, aSeed * 1.7, aSeed * 2.3);
  float base = simplex3(position / uPeriod + seed) * 0.5 + 0.5;       // [0,1]
  float ridged = 1.0 - abs(simplex3(position / (uPeriod * 0.5) + seed)); // sharp ridges
  float disp = uAmplitude * (0.6 * base + 0.4 * ridged);

  vec3 dpos = position * (1.0 + disp);
  vHeight = disp;

  vec4 worldPos = modelMatrix * instanceMatrix * vec4(dpos, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
