// Planet surface fragment shader. Two surface styles:
//   uBanded == 0  → rocky: analytic bump + 5-layer height biomes + polar caps
//   uBanded == 1  → gaseous: horizontal latitude bands + optional storm spot
// World-space Lambert/Phong lighting from the sun. Requires the noise library
// (terrainHeight / cloudFbm / PI) prepended.

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

// surface style
uniform int uSimple; // 1 = moon: flat base colour + crater bump, no biomes
uniform int uBanded;
uniform float uBandFreq;
uniform float uPolarCaps;
uniform vec3 uSpotColor;
uniform vec3 uSpotDir;
uniform float uSpotStrength;
uniform float uSpotSize;

varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  vec3 nrm = normalize(vLocalPos); // unit surface direction; nrm.y = latitude

  float h = terrainHeight(uType, vLocalPos + uSeed, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);

  vec3 surface;
  float specAmount = 0.0;
  vec3 N;

  if (uSimple == 1) {
    // --- moon: crater bump + a single matte base colour (no biome layers) ---
    vec3 dx = uBumpOffset * vTangent;
    vec3 dy = uBumpOffset * vBitangent;
    float h_dx = terrainHeight(uType, vLocalPos + uSeed + dx, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);
    float h_dy = terrainHeight(uType, vLocalPos + uSeed + dy, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);
    vec3 pos = vLocalPos * (uRadius * (1.0 + h));
    vec3 pos_dx = (vLocalPos + dx) * (uRadius * (1.0 + h_dx));
    vec3 pos_dy = (vLocalPos + dy) * (uRadius * (1.0 + h_dy));
    vec3 bumpNormal = normalize(cross(pos_dx - pos, pos_dy - pos));
    N = normalize(mix(vNormal, bumpNormal, uBumpStrength));
    // Faint height shading so craters/maria read, around the mid base colour.
    surface = uColor3 * (0.82 + 0.36 * clamp(h / max(uAmplitude, 1e-4), 0.0, 1.0));
  } else if (uBanded == 1) {
    // --- gas / ice giant: horizontal bands by latitude ---
    float perturb = (cloudFbm(vLocalPos * 2.0 + uSeed) - 0.5) * 1.2;
    float band = sin(nrm.y * PI * uBandFreq + perturb) * 0.5 + 0.5;
    vec3 c = mix(uColor1, uColor2, smoothstep(0.0, 0.4, band));
    c = mix(c, uColor3, smoothstep(0.4, 0.7, band));
    c = mix(c, uColor4, smoothstep(0.7, 1.0, band));
    if (uSpotStrength > 0.0) {
      float d = distance(nrm, normalize(uSpotDir));
      c = mix(c, uSpotColor, smoothstep(uSpotSize, 0.0, d) * uSpotStrength);
    }
    surface = c;
    N = normalize(vNormal); // smooth — no terrain bump on a gas giant
  } else {
    // --- rocky: analytic bump from terrain-height finite differences ---
    vec3 dx = uBumpOffset * vTangent;
    vec3 dy = uBumpOffset * vBitangent;
    float h_dx = terrainHeight(uType, vLocalPos + uSeed + dx, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);
    float h_dy = terrainHeight(uType, vLocalPos + uSeed + dy, uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);
    vec3 pos = vLocalPos * (uRadius * (1.0 + h));
    vec3 pos_dx = (vLocalPos + dx) * (uRadius * (1.0 + h_dx));
    vec3 pos_dy = (vLocalPos + dy) * (uRadius * (1.0 + h_dy));
    vec3 bumpNormal = normalize(cross(pos_dx - pos, pos_dy - pos));
    // planet mesh carries only a translation, so the local normal IS the world
    // normal (modelMatrix is vertex-only and unavailable here).
    N = normalize(mix(vNormal, bumpNormal, uBumpStrength));

    // 5-layer height biomes
    vec3 c = mix(uColor1, uColor2, smoothstep(uTransition2 - uBlend12, uTransition2 + uBlend12, h));
    c = mix(c, uColor3, smoothstep(uTransition3 - uBlend23, uTransition3 + uBlend23, h));
    c = mix(c, uColor4, smoothstep(uTransition4 - uBlend34, uTransition4 + uBlend34, h));
    c = mix(c, uColor5, smoothstep(uTransition5 - uBlend45, uTransition5 + uBlend45, h));
    // polar ice caps
    c = mix(c, vec3(0.95, 0.96, 0.98), smoothstep(0.82, 0.9, abs(nrm.y)) * uPolarCaps);
    surface = c;
    specAmount = clamp((uTransition3 - h) / max(uTransition3, 1e-4), 0.0, 1.0); // oceans shinier
  }

  // --- lighting (world space) ---
  vec3 L = normalize(uSunPosition - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = normalize(reflect(-L, N));
  float diffuse = uDiffuse * max(0.0, dot(N, L));
  float specular = max(0.0, specAmount * uSpecular * pow(max(dot(V, R), 0.0), uShininess));
  float light = uAmbient + diffuse + specular;

  gl_FragColor = vec4(light * surface * uLightColor, 1.0);
}
