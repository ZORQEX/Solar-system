// Planet surface fragment shader (adapted from the reference).
// Analytic bump mapping from terrain-height finite differences, world-space
// Lambert + Phong lighting from the sun direction, and 5-layer height-banded
// biome colouring. Requires the noise library (terrainHeight) prepended.

uniform int uType;
uniform float uRadius;
uniform float uAmplitude;
uniform float uSharpness;
uniform float uOffset;
uniform float uPeriod;
uniform float uPersistence;
uniform float uLacunarity;
uniform int uOctaves;
uniform vec3 uSeed;

// Biome layer colours + transitions + blend widths (the reference's model).
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform float uTransition2;
uniform float uTransition3;
uniform float uTransition4;
uniform float uTransition5;
uniform float uBlend12;
uniform float uBlend23;
uniform float uBlend34;
uniform float uBlend45;

uniform float uBumpStrength;
uniform float uBumpOffset;

uniform float uAmbient;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;
uniform vec3 uSunPosition; // world-space position of the sun
uniform vec3 uLightColor;

varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  float h = terrainHeight(uType, vLocalPos + uSeed, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);

  // Bump mapping: sample height at small tangent/bitangent offsets.
  vec3 dx = uBumpOffset * vTangent;
  vec3 dy = uBumpOffset * vBitangent;
  float h_dx = terrainHeight(uType, vLocalPos + uSeed + dx, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);
  float h_dy = terrainHeight(uType, vLocalPos + uSeed + dy, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);

  vec3 pos = vLocalPos * (uRadius * (1.0 + h));
  vec3 pos_dx = (vLocalPos + dx) * (uRadius * (1.0 + h_dx));
  vec3 pos_dy = (vLocalPos + dy) * (uRadius * (1.0 + h_dy));

  vec3 bumpNormal = normalize(cross(pos_dx - pos, pos_dy - pos));
  // The planet mesh carries only a translation (terrain displacement lives in
  // the shader), so its local normal already equals the world normal. (Note:
  // modelMatrix is a vertex-only built-in — it is NOT available in fragment
  // shaders, so we must not reference it here.)
  vec3 N = normalize(mix(vNormal, bumpNormal, uBumpStrength));

  vec3 L = normalize(uSunPosition - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = normalize(reflect(-L, N));

  float diffuse = uDiffuse * max(0.0, dot(N, L));
  float specularFalloff = clamp((uTransition3 - h) / max(uTransition3, 1e-4), 0.0, 1.0);
  float specular = max(0.0, specularFalloff * uSpecular * pow(max(dot(V, R), 0.0), uShininess));
  float light = uAmbient + diffuse + specular;

  vec3 c = mix(uColor1, uColor2, smoothstep(uTransition2 - uBlend12, uTransition2 + uBlend12, h));
  c = mix(c, uColor3, smoothstep(uTransition3 - uBlend23, uTransition3 + uBlend23, h));
  c = mix(c, uColor4, smoothstep(uTransition4 - uBlend34, uTransition4 + uBlend34, h));
  c = mix(c, uColor5, smoothstep(uTransition5 - uBlend45, uTransition5 + uBlend45, h));

  gl_FragColor = vec4(light * c * uLightColor, 1.0);
}
