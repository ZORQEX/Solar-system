// Asteroid fragment shader. Lambert lighting from the sun plus a crevice-darken
// term from the displaced height for a cratered, rocky read. No noise needed.
uniform vec3 uColor;
uniform vec3 uSunPosition;
uniform float uAmbient;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vHeight;

void main() {
  vec3 N = normalize(vWorldNormal);
  float diffuse = max(0.0, dot(N, normalize(uSunPosition - vWorldPos)));
  float light = uAmbient + diffuse;
  vec3 c = uColor * (0.6 + 0.4 * smoothstep(-0.2, 0.4, vHeight));
  gl_FragColor = vec4(light * c, 1.0);
}
