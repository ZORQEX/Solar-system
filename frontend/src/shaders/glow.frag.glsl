// Radial glow for stars: bright core fading smoothly to transparent edges.
// Rendered on a camera-facing quad with additive blending.
precision mediump float;

uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  float d = length(vUv - 0.5) * 2.0;     // 0 at centre, 1 at edge
  float a = smoothstep(1.0, 0.0, d);     // fade out toward the rim
  a = pow(a, 2.2) * uIntensity;          // tighten the core, scale brightness
  gl_FragColor = vec4(uColor, a);
}
