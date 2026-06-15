/**
 * Wire protocol shared by the authoritative server and every client.
 *
 * The server owns the universe; clients observe snapshots and send commands to
 * intervene. Messages are JSON objects discriminated by `type`.
 */
import type { BodyData } from "./types.ts";

export const PROTOCOL_VERSION = 1;

export interface WorldInfo {
  name: string;
  timeSeconds: number;
  bodyCount: number;
}

/** Messages the server sends to clients. */
export type ServerMessage =
  | {
      type: "welcome";
      protocol: number;
      clientId: string;
      world: WorldInfo;
      snapshot: BodyData[];
    }
  | {
      type: "snapshot";
      timeSeconds: number;
      steps: number;
      bodies: BodyData[];
    }
  | { type: "info"; message: string }
  | { type: "ack"; command: ClientMessage["type"] }
  | { type: "error"; message: string }
  /** Number of clients currently observing the universe. */
  | { type: "presence"; clients: number };

/** Messages clients send to the server. */
export type ClientMessage =
  | { type: "requestState" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "setTimeScale"; scale: number }
  | { type: "resetTime" }
  | { type: "addBody"; body: BodyData };

export type ClientMessageType = ClientMessage["type"];
