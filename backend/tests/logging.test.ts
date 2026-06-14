import { test } from "node:test";
import assert from "node:assert/strict";
import { createLogger, Metrics, UniverseServer, silentLogger } from "../src/api/index.ts";
import { Simulation } from "../src/simulation/index.ts";

test("logger respects its level threshold", () => {
  const lines: string[] = [];
  const log = createLogger({ level: "warn", sink: (l) => lines.push(l) });
  log.debug("nope");
  log.info("nope");
  log.warn("yes");
  log.error("yes");
  assert.equal(lines.length, 2);
  assert.ok(lines[0]!.includes("WARN"));
});

test("logger formats metadata and child scopes", () => {
  const lines: string[] = [];
  const log = createLogger({ level: "info", scope: "server", sink: (l) => lines.push(l) });
  log.info("hello", { clientId: "c1", n: 3 });
  assert.ok(lines[0]!.includes("server"));
  assert.ok(lines[0]!.includes('clientId="c1"'));
  assert.ok(lines[0]!.includes("n=3"));

  const child = log.child("ws");
  child.info("hi");
  assert.ok(lines[1]!.includes("server:ws"));
});

test("logger json mode emits parseable lines", () => {
  const lines: string[] = [];
  const log = createLogger({ json: true, sink: (l) => lines.push(l) });
  log.info("event", { a: 1 });
  const parsed = JSON.parse(lines[0]!) as { level: string; message: string; a: number };
  assert.equal(parsed.level, "info");
  assert.equal(parsed.message, "event");
  assert.equal(parsed.a, 1);
});

test("metrics count connections and ticks", () => {
  const m = new Metrics();
  m.onConnect();
  m.onConnect();
  m.onDisconnect();
  m.ticks = 5;
  const snap = m.snapshot();
  assert.equal(snap.wsConnectionsTotal, 2);
  assert.equal(snap.wsActive, 1);
  assert.equal(snap.ticks, 5);
  assert.ok(snap.uptimeSeconds >= 0);
});

test("GET /api/metrics reflects activity", async () => {
  const server = new UniverseServer(Simulation.fromSeed(1), { logger: silentLogger });
  const port = await server.listen(0);
  try {
    server.tickOnce(0.016);
    await fetch(`http://localhost:${port}/api/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "pause" }),
    });
    const m = (await (await fetch(`http://localhost:${port}/api/metrics`)).json()) as {
      ticks: number;
      commandsApplied: number;
      httpRequests: number;
    };
    assert.ok(m.ticks >= 1);
    assert.ok(m.commandsApplied >= 1);
    assert.ok(m.httpRequests >= 1);
  } finally {
    await server.close();
  }
});
