import * as THREE from "three";
import { AU, type BodyData, type BodyType } from "../shared.ts";

/** Scene units per AU. Positions are divided by AU, so 1 AU = 1 unit. */
export const UNITS_PER_AU = 1;

/** Convert an SI position (metres) to a Three.js scene vector. */
export function toScene(position: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(
    (position.x / AU) * UNITS_PER_AU,
    (position.z / AU) * UNITS_PER_AU, // map sim Z (up) to Three Y (up)
    (position.y / AU) * UNITS_PER_AU,
  );
}

/**
 * Display radius in scene units. Real radii are negligible next to orbital
 * distances, so we use a fixed per-type size (log-nudged by physical radius)
 * to keep everything visible.
 */
export function displayRadius(body: BodyData): number {
  const base: Record<BodyType, number> = {
    star: 0.18,
    "gas-giant": 0.09,
    planet: 0.05,
    moon: 0.03,
    asteroid: 0.025,
    comet: 0.025,
    "black-hole": 0.08,
    "neutron-star": 0.06,
    generic: 0.04,
  };
  return base[body.type] ?? 0.04;
}

/** True for bodies that should emit light + a glow billboard. */
export function isLuminous(body: BodyData): boolean {
  return body.type === "star" || body.type === "neutron-star";
}

const TYPE_COLOR: Record<BodyType, string> = {
  star: "#fff4ea",
  "gas-giant": "#d8b48c",
  planet: "#2e6fdb",
  moon: "#9aa0a6",
  asteroid: "#9c8e7e",
  comet: "#bfe7f0",
  "black-hole": "#000000",
  "neutron-star": "#e8f0ff",
  generic: "#cccccc",
};

export function bodyColor(body: BodyData): THREE.Color {
  return new THREE.Color(body.color ?? TYPE_COLOR[body.type] ?? "#cccccc");
}
