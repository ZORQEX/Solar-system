import { Vector3 } from "./vector3.ts";
import type { BodyData, BodyType, PlanetSubtype } from "../shared.ts";

/**
 * A gravitating body. Unlike `Vector3`, a `Body` is *mutable*: the integrator
 * advances `position`, `velocity` and `acceleration` in place each step, which
 * is far cheaper than reallocating thousands of bodies per frame.
 *
 * `mass`, `radius` and `type` only change through explicit operations such as a
 * merge (see `collisions.ts`).
 */
export class Body {
  id: string;
  type: BodyType;
  mass: number;
  radius: number;
  position: Vector3;
  velocity: Vector3;
  /** Acceleration from the most recent force evaluation (m/s²). */
  acceleration: Vector3;
  name: string | undefined;
  color: string | undefined;
  /** Cosmetic render hints — carried through but never used by the physics core. */
  subtype: PlanetSubtype | undefined;
  parentId: string | undefined;

  /** Set false when a body has been absorbed by a merge; skipped thereafter. */
  alive = true;

  constructor(params: {
    id: string;
    type?: BodyType;
    mass: number;
    radius: number;
    position: Vector3;
    velocity?: Vector3;
    name?: string;
    color?: string;
    subtype?: PlanetSubtype;
    parentId?: string;
  }) {
    this.id = params.id;
    this.type = params.type ?? "generic";
    this.mass = params.mass;
    this.radius = params.radius;
    this.position = params.position;
    this.velocity = params.velocity ?? Vector3.zero();
    this.acceleration = Vector3.zero();
    this.name = params.name;
    this.color = params.color;
    this.subtype = params.subtype;
    this.parentId = params.parentId;
  }

  /** Linear momentum, p = m·v (vector, kg·m/s). */
  momentum(): Vector3 {
    return this.velocity.scale(this.mass);
  }

  /** Kinetic energy, ½·m·|v|² (J). */
  kineticEnergy(): number {
    return 0.5 * this.mass * this.velocity.lengthSq();
  }

  static fromData(data: BodyData): Body {
    return new Body({
      id: data.id,
      type: data.type,
      mass: data.mass,
      radius: data.radius,
      position: Vector3.from(data.position),
      velocity: Vector3.from(data.velocity),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.subtype !== undefined ? { subtype: data.subtype } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
    });
  }

  toData(): BodyData {
    return {
      id: this.id,
      type: this.type,
      mass: this.mass,
      radius: this.radius,
      position: this.position.toJSON(),
      velocity: this.velocity.toJSON(),
      ...(this.name !== undefined ? { name: this.name } : {}),
      ...(this.color !== undefined ? { color: this.color } : {}),
      ...(this.subtype !== undefined ? { subtype: this.subtype } : {}),
      ...(this.parentId !== undefined ? { parentId: this.parentId } : {}),
    };
  }
}
