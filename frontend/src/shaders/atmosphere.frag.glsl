// Atmosphere shell fragment shader. Rendered on a slightly larger BackSide
// sphere with additive blending: a soft Fresnel rim that glows at the limb.
uniform vec3 atmosphereColor;
uniform float intensity;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  float vFresnel = dot(normalize(vNormal), normalize(-vViewPosition));
  float rim = 1.0 - abs(vFresnel);
  float atmosphere = pow(rim, 3.0) * intensity;
  gl_FragColor = vec4(atmosphereColor, atmosphere);
}
