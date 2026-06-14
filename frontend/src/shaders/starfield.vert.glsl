// Background starfield: per-point size with a subtle seeded brightness.
attribute float aBrightness;
uniform float uSize;
varying float vBrightness;

void main() {
  vBrightness = aBrightness;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * aBrightness;
  gl_Position = projectionMatrix * mv;
}
