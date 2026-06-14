// Round, soft-edged background stars.
precision mediump float;
varying float vBrightness;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;                  // clip to a circle
  float a = smoothstep(0.5, 0.0, d) * vBrightness;
  gl_FragColor = vec4(vec3(1.0), a);
}
