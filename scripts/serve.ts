/**
 * Start the authoritative universe server.  Run with:  npm run serve
 *
 *   PORT=8080 SEED=777 npm run serve
 *
 * Connect a WebSocket to ws://localhost:PORT to observe snapshots, or hit the
 * REST API at http://localhost:PORT/api/health.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Simulation } from "../backend/src/simulation/index.ts";
import { UniverseServer, createLogger, type LogLevel } from "../backend/src/api/index.ts";
import { SECONDS_PER_DAY } from "../shared/src/constants.ts";
import type { ScenarioData } from "../shared/src/types.ts";

const port = Number(process.env.PORT ?? 8080);
const seed = process.env.SEED ? Number(process.env.SEED) : null;

let sim: Simulation;
if (seed !== null) {
  sim = Simulation.fromSeed(seed, { timeScale: SECONDS_PER_DAY });
} else {
  const here = dirname(fileURLToPath(import.meta.url));
  const scenario = JSON.parse(
    readFileSync(join(here, "..", "data", "solar-system.json"), "utf8"),
  ) as ScenarioData;
  sim = Simulation.fromScenario(scenario, { timeScale: SECONDS_PER_DAY });
}

const logger = createLogger({
  scope: "universe",
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  json: process.env.LOG_JSON === "1",
});
const authToken = process.env.AUTH_TOKEN;
const server = new UniverseServer(sim, {
  logger,
  ...(authToken ? { authToken } : {}),
});
const actualPort = await server.listen(port);
server.start();

console.log(`Universe server listening on http://localhost:${actualPort}`);
console.log(`  REST:      GET http://localhost:${actualPort}/api/health`);
console.log(`  WebSocket: ws://localhost:${actualPort}`);
console.log(`  time scale: ${sim.time.scale} sim-seconds / real-second`);
console.log(`  auth:       ${authToken ? "required (AUTH_TOKEN set)" : "open"}`);

const shutdown = () => {
  console.log("\nshutting down…");
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
