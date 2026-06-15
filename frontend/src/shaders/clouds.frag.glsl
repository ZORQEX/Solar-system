// Cloud layer fragment shader. `noise.glsl` (snoise + fbm) is prepended at build
// time. Procedural fbm clouds, thresholded for sharp edges, drifting with wind,
// and shaded by the sun so the night side stays dark.
uniform float time;
uniform float windSpeed;
uniform float cloudScale;
uniform float opacity;
uniform vec3 cloudColor;
uniform vec3 sunDirection;

varying vec3 vLocalPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = normalize(vLocalPos);
  float n = fbm(p * cloudScale + vec3(time * windSpeed));
  float clouds = smoothstep(0.4, 0.7, n);
  float a = clouds * opacity;
  if (a < 0.01) discard;

  float NdotL = dot(normalize(vWorldNormal), normalize(sunDirection));
  float shade = 0.15 + 0.85 * clamp(NdotL, 0.0, 1.0); // a little ambient at night
  gl_FragColor = vec4(cloudColor * shade, a);
}
