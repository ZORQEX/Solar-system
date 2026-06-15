/**
 * Runtime validation for untrusted input crossing the wire (client commands,
 * loaded scenarios/saves). The static types describe the *shape* we expect;
 * these functions enforce it at runtime and produce clear error messages so a
 * malformed request becomes a 400, never a crash deep in the engine.
 */
import {
  BODY_TYPES,
  type BodyData,
  type ScenarioData,
  type Vec3Data,
} from "./types.ts";
import type { ClientMessage } from "./protocol.ts";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function num(x: unknown, path: string): number {
  if (typeof x !== "number" || !Number.isFinite(x)) {
    throw new ValidationError(`${path} must be a finite number`);
  }
  return x;
}

function nonNegative(x: unknown, path: string): number {
  const n = num(x, path);
  if (n < 0) throw new ValidationError(`${path} must be >= 0`);
  return n;
}

function str(x: unknown, path: string): string {
  if (typeof x !== "string" || x.length === 0) {
    throw new ValidationError(`${path} must be a non-empty string`);
  }
  return x;
}

export function validateVec3(x: unknown, path: string): Vec3Data {
  if (!isObject(x)) throw new ValidationError(`${path} must be an object`);
  return {
    x: num(x.x, `${path}.x`),
    y: num(x.y, `${path}.y`),
    z: num(x.z, `${path}.z`),
  };
}

export function validateBodyData(x: unknown, path = "body"): BodyData {
  if (!isObject(x)) throw new ValidationError(`${path} must be an object`);

  const type = x.type;
  if (
    typeof type !== "string" ||
    !(BODY_TYPES as readonly string[]).includes(type)
  ) {
    throw new ValidationError(
      `${path}.type must be one of: ${BODY_TYPES.join(", ")}`,
    );
  }

  const body: BodyData = {
    id: str(x.id, `${path}.id`),
    type: type as BodyData["type"],
    mass: nonNegative(x.mass, `${path}.mass`),
    radius: nonNegative(x.radius, `${path}.radius`),
    position: validateVec3(x.position, `${path}.position`),
    velocity: validateVec3(x.velocity, `${path}.velocity`),
  };
  if (x.name !== undefined) body.name = str(x.name, `${path}.name`);
  if (x.color !== undefined) body.color = str(x.color, `${path}.color`);
  return body;
}

export function validateScenario(x: unknown): ScenarioData {
  if (!isObject(x)) throw new ValidationError("scenario must be an object");
  if (!Array.isArray(x.bodies))
    throw new ValidationError("scenario.bodies must be an array");

  const scenario: ScenarioData = {
    name: str(x.name, "scenario.name"),
    bodies: x.bodies.map((b, i) =>
      validateBodyData(b, `scenario.bodies[${i}]`),
    ),
  };
  if (x.description !== undefined)
    scenario.description = str(x.description, "scenario.description");
  if (x.G !== undefined) scenario.G = num(x.G, "scenario.G");
  if (x.softening !== undefined)
    scenario.softening = nonNegative(x.softening, "scenario.softening");
  return scenario;
}

export function validateClientMessage(x: unknown): ClientMessage {
  if (!isObject(x)) throw new ValidationError("message must be an object");

  switch (x.type) {
    case "requestState":
    case "pause":
    case "resume":
    case "resetTime":
      return { type: x.type };
    case "setTimeScale":
      return {
        type: "setTimeScale",
        scale: nonNegative(x.scale, "message.scale"),
      };
    case "addBody":
      return {
        type: "addBody",
        body: validateBodyData(x.body, "message.body"),
      };
    default:
      throw new ValidationError(
        `unknown message type: ${JSON.stringify(x.type)}`,
      );
  }
}
