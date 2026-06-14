import { validateBodyData, ValidationError } from "../shared.ts";
import type { WorldSave } from "../simulation/index.ts";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function array(x: unknown, path: string): unknown[] {
  if (!Array.isArray(x)) throw new ValidationError(`${path} must be an array`);
  return x;
}

function finiteNum(x: unknown, path: string): number {
  if (typeof x !== "number" || !Number.isFinite(x)) {
    throw new ValidationError(`${path} must be a finite number`);
  }
  return x;
}

/**
 * Validate an untrusted save payload before it replaces the live world. Bodies
 * get full validation (they drive the physics); the entity registries are
 * checked structurally so `World.fromSave` never trips over a missing array.
 */
export function validateWorldSave(x: unknown): WorldSave {
  if (!isObject(x)) throw new ValidationError("save must be an object");

  const engine = x.engine;
  if (!isObject(engine)) throw new ValidationError("save.engine must be an object");
  if (typeof engine.collisions !== "boolean") {
    throw new ValidationError("save.engine.collisions must be a boolean");
  }
  finiteNum(engine.G, "save.engine.G");
  finiteNum(engine.theta, "save.engine.theta");
  finiteNum(engine.softening, "save.engine.softening");

  if (typeof x.name !== "string") throw new ValidationError("save.name must be a string");
  finiteNum(x.timeSeconds, "save.timeSeconds");

  array(x.bodies, "save.bodies").forEach((b, i) => validateBodyData(b, `save.bodies[${i}]`));
  array(x.stars, "save.stars");
  if (x.planets !== undefined) array(x.planets, "save.planets");
  array(x.biospheres, "save.biospheres");
  array(x.civilizations, "save.civilizations");

  return x as unknown as WorldSave;
}
