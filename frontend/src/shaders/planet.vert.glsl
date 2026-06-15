// Rocky-planet surface vertex shader. World normal for sun shading; object-space
// position for procedural surface detail and city lights.
varying vec3 vWorldNormal;
varying vec3 vLocalPos;

void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
