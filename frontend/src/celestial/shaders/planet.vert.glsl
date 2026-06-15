// Planet surface vertex shader (adapted from the reference).
// Displaces a unit sphere by procedural terrain height; because our planets are
// tiny (displayRadius scene units, not the reference's ~20), displacement is a
// *fraction of radius*: pos = dir * radius * (1 + h). Lighting is done in world
// space (our meshes are translated to orbit positions), so we pass world data.
//
// Requires the noise library (terrainHeight) prepended.
attribute vec3 tangent;

uniform int uType;
uniform float uRadius;
uniform float uAmplitude;
uniform float uSharpness;
uniform float uOffset;
uniform float uPeriod;
uniform float uPersistence;
uniform float uLacunarity;
uniform int uOctaves;
uniform vec3 uSeed; // per-body offset for deterministic uniqueness

varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  float h = terrainHeight(
    uType, position + uSeed,
    uAmplitude, uSharpness, uOffset, uPeriod, uPersistence, uLacunarity, uOctaves);

  vec3 dpos = position * (uRadius * (1.0 + h));
  vec4 world = modelMatrix * vec4(dpos, 1.0);

  vLocalPos = position;
  vWorldPos = world.xyz;
  vNormal = normal;
  vTangent = tangent;
  vBitangent = cross(normal, tangent);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(dpos, 1.0);
}
