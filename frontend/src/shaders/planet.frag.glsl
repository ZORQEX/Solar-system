// Rocky-planet surface fragment shader. `noise.glsl` is prepended at build time.
// Day/night terminator from the sun direction; the lit side gets subtle
// procedural surface variation, the dark side gets faked city lights (Earth).
uniform vec3 sunDirection;
uniform vec3 dayColor;
uniform float cityLights; // 1.0 = inhabited (Earth), 0.0 = none

varying vec3 vWorldNormal;
varying vec3 vLocalPos;

void main() {
  vec3 n = normalize(vLocalPos);
  float NdotL = dot(normalize(vWorldNormal), normalize(sunDirection));
  float terminator = smoothstep(-0.1, 0.1, NdotL);

  // Lit (day) side: base colour modulated by low-frequency surface noise.
  float surf = fbm(n * 4.0);
  vec3 dayCol = dayColor * (0.8 + 0.4 * surf);

  // Dark (night) side: nearly black, plus faked city lights where inhabited.
  vec3 nightCol = dayColor * 0.05;
  float lights = fbm(n * 18.0);
  lights = smoothstep(0.55, 0.75, lights) * (1.0 - terminator) * cityLights;
  nightCol += vec3(1.0, 0.85, 0.45) * lights * 0.8;

  vec3 color = mix(nightCol, dayCol, terminator);
  gl_FragColor = vec4(color, 1.0);
}
