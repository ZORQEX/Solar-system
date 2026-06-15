import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { Simulation } from "../src/simulation/index.ts";
import { UniverseServer, silentLogger } from "../src/api/index.ts";
import type { ServerMessage } from "../src/shared.ts";

const TOKEN = "s3cret";

async function withAuthServer(
  fn: (port: number) => Promise<void>,
): Promise<void> {
  const server = new UniverseServer(Simulation.fromSeed(1), {
    logger: silentLogger,
    authToken: TOKEN,
  });
  const port = await server.listen(0);
  try {
    await fn(port);
  } finally {
    await server.close();
  }
}

function firstMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    ws.once("message", (raw) => resolve(JSON.parse(raw.toString()) as ServerMessage));
    ws.once("error", reject);
  });
}

test("open endpoints stay reachable without a token", async () => {
  await withAuthServer(async (port) => {
    assert.equal((await fetch(`http://localhost:${port}/api/health`)).status, 200);
    assert.equal((await fetch(`http://localhost:${port}/api/state`)).status, 200);
    assert.equal((await fetch(`http://localhost:${port}/api/metrics`)).status, 200);
  });
});

test("protected REST endpoints require a bearer token", async () => {
  await withAuthServer(async (port) => {
    assert.equal((await fetch(`http://localhost:${port}/api/save`)).status, 401);

    const ok = await fetch(`http://localhost:${port}/api/save`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(ok.status, 200);

    const cmd = await fetch(`http://localhost:${port}/api/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "pause" }),
    });
    assert.equal(cmd.status, 401);
  });
});

test("WebSocket rejects connections without the token", async () => {
  await withAuthServer(async (port) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const msg = await firstMessage(ws);
    assert.equal(msg.type, "error");
    ws.close();
  });
});

test("WebSocket accepts connections with the token", async () => {
  await withAuthServer(async (port) => {
    const ws = new WebSocket(`ws://localhost:${port}?token=${TOKEN}`);
    const msg = await firstMessage(ws);
    assert.equal(msg.type, "welcome");
    ws.close();
  });
});
