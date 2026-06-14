import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { Simulation } from "../src/simulation/index.ts";
import { UniverseServer, silentLogger } from "../src/api/index.ts";
import type { ServerMessage } from "../src/shared.ts";

/** Spin up a server on an ephemeral port, run `fn`, then tear everything down. */
async function withServer(
  fn: (port: number, server: UniverseServer) => Promise<void>,
): Promise<void> {
  const server = new UniverseServer(Simulation.fromSeed(777), { logger: silentLogger });
  const port = await server.listen(0);
  try {
    await fn(port, server);
  } finally {
    await server.close();
  }
}

/**
 * Buffering WebSocket client. It records every message from the moment the
 * socket is created, so a `welcome` sent immediately on connect is never lost
 * to the open → attach-listener race.
 */
class WsClient {
  readonly ws: WebSocket;
  private readonly buffer: ServerMessage[] = [];
  private readonly waiters: Array<{
    match: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
  }> = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      const i = this.waiters.findIndex((w) => w.match(msg));
      if (i >= 0) this.waiters.splice(i, 1)[0]!.resolve(msg);
      else this.buffer.push(msg);
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });
  }

  next(match: (m: ServerMessage) => boolean, timeoutMs = 2000): Promise<ServerMessage> {
    const i = this.buffer.findIndex(match);
    if (i >= 0) return Promise.resolve(this.buffer.splice(i, 1)[0]!);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve };
      this.waiters.push(waiter);
      setTimeout(() => {
        const idx = this.waiters.indexOf(waiter);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
          reject(new Error("timed out waiting for message"));
        }
      }, timeoutMs);
    });
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    this.ws.close();
  }
}

test("REST /api/health reports world status", async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; bodyCount: number };
    assert.equal(body.status, "ok");
    assert.ok(body.bodyCount >= 1);
  });
});

test("REST /api/state returns a snapshot of bodies", async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/api/state`);
    const body = (await res.json()) as { bodies: unknown[] };
    assert.ok(Array.isArray(body.bodies));
    assert.ok(body.bodies.length >= 1);
  });
});

test("REST save → load round-trips through the server", async () => {
  await withServer(async (port) => {
    const save = await (await fetch(`http://localhost:${port}/api/save`)).json();
    const res = await fetch(`http://localhost:${port}/api/load`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(save),
    });
    assert.equal(res.status, 200);
    const result = (await res.json()) as { status: string };
    assert.equal(result.status, "loaded");
  });
});

test("REST /api/command rejects an invalid time scale", async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/api/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "setTimeScale", scale: -5 }),
    });
    assert.equal(res.status, 400);
  });
});

test("REST /api/command rejects an addBody with a malformed body", async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/api/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "addBody", body: { id: "x" } }),
    });
    assert.equal(res.status, 400);
  });
});

test("REST /api/load rejects a structurally invalid save", async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/api/load`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ not: "a save" }),
    });
    assert.equal(res.status, 400);
  });
});

test("WebSocket reports a validation error for a malformed command", async () => {
  await withServer(async (port) => {
    const client = new WsClient(`ws://localhost:${port}`);
    await client.open();
    await client.next((m) => m.type === "welcome");
    client.send({ type: "setTimeScale", scale: "fast" });
    const err = await client.next((m) => m.type === "error");
    assert.equal(err.type, "error");
    client.close();
  });
});

test("WebSocket client receives a welcome with a snapshot", async () => {
  await withServer(async (port) => {
    const client = new WsClient(`ws://localhost:${port}`);
    await client.open();
    const welcome = await client.next((m) => m.type === "welcome");
    assert.equal(welcome.type, "welcome");
    if (welcome.type === "welcome") {
      assert.equal(welcome.protocol, 1);
      assert.ok(welcome.snapshot.length >= 1);
      assert.ok(welcome.clientId.startsWith("c"));
    }
    client.close();
  });
});

test("an addBody command is acked and broadcast to observers", async () => {
  await withServer(async (port) => {
    const client = new WsClient(`ws://localhost:${port}`);
    await client.open();
    const welcome = await client.next((m) => m.type === "welcome");
    const before = welcome.type === "welcome" ? welcome.snapshot.length : 0;

    client.send({
      type: "addBody",
      body: {
        id: "intruder",
        type: "asteroid",
        mass: 1e20,
        radius: 1e5,
        position: { x: 1e11, y: 0, z: 0 },
        velocity: { x: 0, y: 1e4, z: 0 },
      },
    });

    await client.next((m) => m.type === "ack");
    const snap = await client.next((m) => m.type === "snapshot");
    if (snap.type === "snapshot") {
      assert.equal(snap.bodies.length, before + 1);
      assert.ok(snap.bodies.some((b) => b.id === "intruder"));
    }
    client.close();
  });
});

test("observers are notified of presence when clients join and leave", async () => {
  await withServer(async (port) => {
    const a = new WsClient(`ws://localhost:${port}`);
    await a.open();
    await a.next((m) => m.type === "welcome");
    // First client should see presence of 1 (itself).
    const p1 = await a.next((m) => m.type === "presence");
    if (p1.type === "presence") assert.equal(p1.clients, 1);

    // A second client joins → first client sees the count rise.
    const b = new WsClient(`ws://localhost:${port}`);
    await b.open();
    const p2 = await a.next((m) => m.type === "presence" && m.clients === 2);
    assert.equal(p2.type, "presence");

    // …and leaves → the count falls back.
    b.close();
    const p3 = await a.next((m) => m.type === "presence" && m.clients === 1);
    assert.equal(p3.type, "presence");
    a.close();
  });
});

test("malformed JSON over WebSocket yields an error message, not a crash", async () => {
  await withServer(async (port) => {
    const client = new WsClient(`ws://localhost:${port}`);
    await client.open();
    await client.next((m) => m.type === "welcome");
    client.ws.send("{not valid json");
    const err = await client.next((m) => m.type === "error");
    assert.equal(err.type, "error");
    client.close();
  });
});
