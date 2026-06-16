// Instanced matte-body shader for the named "major" satellites — a quiet matte
// look (Lambert + subtle surface mottle), made instancing-friendly.
//
// three.js injects `instanceMatrix` (USE_INSTANCING) and `instanceColor`
// (USE_INSTANCING_COLOR, present because the InstancedMesh sets per-instance
// colours) into a ShaderMaterial's vertex prefix — so we must NOT redeclare
// them here. `position`/`normal` and the camera matrices are built-ins too.
varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vTint;

void main() {
  vTint = instanceColor;
  vLocalPos = position;

  mat4 world = modelMatrix * instanceMatrix;
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  // Instance + group scale is uniform, so mat3(world) preserves normal dir.
  vWorldNormal = normalize(mat3(world) * normal);

  gl_Position = projectionMatrix * viewMatrix * wp;
}
