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

/** Volumetric look (atmosphere / clouds / day-night) for a body. */
export interface PlanetAppearance {
  hasAtmosphere: boolean;
  atmosphereColor: [number, number, number];
  atmosphereIntensity: number;
  hasClouds: boolean;
  cloudOpacity: number;
  cloudColor: [number, number, number];
  /** Use the day/night terminator shader for the body's surface. */
  terminatorSurface: boolean;
  /** 1 = render faked city lights on the night side (Earth-like). */
  cityLights: number;
}

const NO_APPEARANCE: PlanetAppearance = {
  hasAtmosphere: false,
  atmosphereColor: [0.5, 0.7, 1.0],
  atmosphereIntensity: 1.0,
  hasClouds: false,
  cloudOpacity: 0,
  cloudColor: [1, 1, 1],
  terminatorSurface: false,
  cityLights: 0,
};

/**
 * Decide the atmosphere/cloud/terminator treatment for a body, by name then
 * type. Stars get a warm corona; rocky planets get a day/night surface with
 * per-world atmosphere + clouds; gas giants get a tinted haze and banded clouds;
 * moons/asteroids/etc. get nothing extra.
 */
export function planetAppearance(body: BodyData): PlanetAppearance {
  const key = (body.name ?? body.id).toLowerCase();

  if (body.type === "star" || body.type === "neutron-star") {
    return {
      ...NO_APPEARANCE,
      hasAtmosphere: true,
      atmosphereColor: [1.0, 0.7, 0.2],
      atmosphereIntensity: 2.2,
    };
  }

  if (body.type === "gas-giant") {
    const icy = key.includes("uranus") || key.includes("neptune");
    return {
      ...NO_APPEARANCE,
      hasAtmosphere: true,
      atmosphereColor: icy ? [0.4, 0.7, 0.95] : [0.85, 0.7, 0.5],
      atmosphereIntensity: 1.2,
      hasClouds: true,
      cloudOpacity: 0.4, // bands stay visible underneath
      cloudColor: icy ? [0.7, 0.85, 0.95] : [0.9, 0.8, 0.65],
    };
  }

  if (body.type === "planet") {
    const base: PlanetAppearance = { ...NO_APPEARANCE, terminatorSurface: true };
    if (key.includes("earth") || key.includes("terra")) {
      return { ...base, hasAtmosphere: true, atmosphereColor: [0.3, 0.6, 1.0], atmosphereIntensity: 1.4, hasClouds: true, cloudOpacity: 0.7, cityLights: 1 };
    }
    if (key.includes("venus")) {
      return { ...base, hasAtmosphere: true, atmosphereColor: [1.0, 0.8, 0.3], atmosphereIntensity: 1.6, hasClouds: true, cloudOpacity: 0.95, cloudColor: [1.0, 0.95, 0.8] };
    }
    if (key.includes("mars")) {
      return { ...base, hasAtmosphere: true, atmosphereColor: [1.0, 0.4, 0.2], atmosphereIntensity: 0.8 };
    }
    if (key.includes("mercury")) {
      return base; // airless, day/night only
    }
    // Generic procedurally-generated rocky world: faint air + light clouds.
    return { ...base, hasAtmosphere: true, atmosphereColor: [0.5, 0.7, 1.0], atmosphereIntensity: 0.9, hasClouds: true, cloudOpacity: 0.3 };
  }

  return NO_APPEARANCE; // moon / asteroid / comet / black-hole / generic
}
