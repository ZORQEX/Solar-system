// Atmosphere shell fragment shader. Rendered on a slightly larger BackSide
// sphere with additive blending: a Fresnel rim that glows at the limb, tinted
// toward the lit (sun-facing) side. No noise needed.
uniform vec3 uAtmosphereColor;
uniform float uIntensity;
uniform vec3 uSunPosition;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  float fres = dot(normalize(vViewNormal), normalize(-vViewPos));
  float rim = 1.0 - abs(fres);
  float a = pow(rim, 3.0) * uIntensity;

  vec3 L = normalize(uSunPosition - vWorldPos);
  float lit = 0.3 + 0.7 * clamp(dot(normalize(vWorldNormal), L), 0.0, 1.0);
  gl_FragColor = vec4(uAtmosphereColor * lit, a);
}
