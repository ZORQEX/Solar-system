import { SIMPLEX3_GLSL } from "./simplex.ts";
import { FBM_GLSL } from "./fbm.ts";

export { SIMPLEX3_GLSL } from "./simplex.ts";
export { FBM_GLSL } from "./fbm.ts";

/**
 * The full GLSL noise library, prepended into any shader that references
 * `simplex3` / `fractal3` / `terrainHeight` / `cloudFbm`. Order matters:
 * simplex first (fbm depends on it).
 */
export const NOISE_GLSL = `${SIMPLEX3_GLSL}\n${FBM_GLSL}`;

/** Prepend the noise library before a shader's `void main()`. */
export function withNoise(shaderSource: string): string {
  return `${NOISE_GLSL}\n${shaderSource}`;
}
