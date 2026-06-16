// Saturn ring vertex shader. The annulus geometry is built in units of Saturn's
// own radius (1.05–2.40 R) in the local XY plane; mesh.scale applies the actual
// radius. We forward the in-plane coordinate so the fragment can read the radius
// as a multiple of R and look up the ring bands directly.
varying vec2 vRingPos;

void main() {
  vRingPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
