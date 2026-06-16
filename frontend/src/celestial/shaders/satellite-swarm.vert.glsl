// Swarm point shader: tiny generic moons as distance-attenuated points.
// `position` is the per-point local orbit position (the Points object is a
// child of the planet's group, so it inherits the planet's world transform).
attribute vec3 color;
attribute float size;
varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z); // distance attenuation
  gl_Position = projectionMatrix * mvPosition;
}
