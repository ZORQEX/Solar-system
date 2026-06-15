// Cloud layer vertex shader. Object-space position drives the noise (so clouds
// stay fixed to the surface as the planet orbits); world normal is used for sun
// shading.
varying vec3 vLocalPos;
varying vec3 vWorldNormal;

void main() {
  vLocalPos = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
