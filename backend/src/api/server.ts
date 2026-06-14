import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { Body } from "../core/index.ts";
import { Simulation, World } from "../simulation/index.ts";
import { validateWorldSave } from "./validate-save.ts";
import { createLogger, type Logger } from "./logger.ts";
import { Metrics } from "./metrics.ts";
import {
  PROTOCOL_VERSION,
  validateClientMessage,
  type ClientMessage,
  type ServerMessage,
  type WorldInfo,
} from "../shared.ts";

export interface ServerOptions {
  /** Interval between simulation ticks when the loop is running (ms). */
  tickIntervalMs?: number;
  /** Structured logger. Defaults to an info-level console logger. */
  logger?: Logger;
}

interface IdentifiedSocket extends WebSocket {
  clientId?: string;
}

/**
 * Authoritative universe server. One `Simulation` is the single source of
 * truth; any number of WebSocket clients observe its snapshots and may send
 * commands to intervene (the "multiplayer" model). A small REST surface exposes
 * health, state, and save/load.
 *
 * The tick loop is opt-in (`start()`), so tests can drive the server
 * deterministically with `tickOnce()` and never leak a timer.
 */
export class UniverseServer {
  simulation: Simulation;
  readonly http: Server;
  readonly wss: WebSocketServer;

  private readonly tickIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private nextClientId = 1;
  private readonly startedAt = Date.now();
  readonly logger: Logger;
  readonly metrics = new Metrics();

  constructor(simulation: Simulation, options: ServerOptions = {}) {
    this.simulation = simulation;
    this.tickIntervalMs = options.tickIntervalMs ?? 1000 / 30; // ~30 Hz
    this.logger = options.logger ?? createLogger({ scope: "server" });
    this.http = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.http });
    this.wss.on("connection", (socket) => this.handleConnection(socket));
  }

  // --- lifecycle -----------------------------------------------------------

  listen(port = 0): Promise<number> {
    return new Promise((resolve) => {
      this.http.listen(port, () => {
        const addr = this.http.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      });
    });
  }

  /** Begin advancing the simulation in real time and broadcasting snapshots. */
  start(): void {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const realDt = (now - this.lastTickAt) / 1000;
      this.lastTickAt = now;
      this.tickOnce(realDt);
    }, this.tickIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async close(): Promise<void> {
    this.stop();
    for (const client of this.wss.clients) client.close();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  // --- simulation driving --------------------------------------------------

  /** Advance the simulation by one real-time delta and broadcast the result. */
  tickOnce(realDeltaSeconds: number): void {
    this.metrics.ticks += 1;
    const report = this.simulation.tick(realDeltaSeconds);
    this.broadcast({
      type: "snapshot",
      timeSeconds: this.simulation.timeSeconds,
      steps: report.steps,
      bodies: this.simulation.world.physics.snapshot(),
    });
  }

  private worldInfo(): WorldInfo {
    return {
      name: this.simulation.world.name,
      timeSeconds: this.simulation.timeSeconds,
      bodyCount: this.simulation.world.physics.count,
    };
  }

  // --- WebSocket -----------------------------------------------------------

  private handleConnection(socket: IdentifiedSocket): void {
    socket.clientId = `c${this.nextClientId++}`;
    this.metrics.onConnect();
    this.logger.info("client connected", {
      clientId: socket.clientId,
      active: this.metrics.wsActive,
    });

    this.send(socket, {
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      clientId: socket.clientId,
      world: this.worldInfo(),
      snapshot: this.simulation.world.physics.snapshot(),
    });

    socket.on("message", (raw) => this.handleMessage(socket, raw));
    socket.on("close", () => {
      this.metrics.onDisconnect();
      this.logger.info("client disconnected", {
        clientId: socket.clientId,
        active: this.metrics.wsActive,
      });
      this.broadcastPresence();
    });

    // Let everyone (including the newcomer) know the current observer count.
    this.broadcastPresence();
  }

  private broadcastPresence(): void {
    // Use the metrics counter: on disconnect the ws client set may not have
    // dropped the closing socket yet, but wsActive is already decremented.
    this.broadcast({ type: "presence", clients: this.metrics.wsActive });
  }

  private handleMessage(socket: IdentifiedSocket, raw: RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      this.send(socket, { type: "error", message: "invalid JSON" });
      return;
    }

    try {
      const message = validateClientMessage(parsed);
      const broadcastSnapshot = this.applyCommand(message);
      this.logger.debug("command", { clientId: socket.clientId, type: message.type });
      this.send(socket, { type: "ack", command: message.type });
      if (message.type === "requestState") {
        this.send(socket, {
          type: "snapshot",
          timeSeconds: this.simulation.timeSeconds,
          steps: 0,
          bodies: this.simulation.world.physics.snapshot(),
        });
      } else if (broadcastSnapshot) {
        this.broadcastSnapshot();
      }
    } catch (err) {
      this.metrics.commandErrors += 1;
      const message = err instanceof Error ? err.message : "command failed";
      this.logger.warn("command rejected", { clientId: socket.clientId, error: message });
      this.send(socket, { type: "error", message });
    }
  }

  /**
   * Apply a client command to the authoritative world. Returns true if the
   * change is worth broadcasting a fresh snapshot to all observers.
   */
  applyCommand(message: ClientMessage): boolean {
    this.metrics.commandsApplied += 1;
    switch (message.type) {
      case "requestState":
        return false;
      case "pause":
        this.simulation.time.pause();
        this.broadcast({ type: "info", message: "paused" });
        return false;
      case "resume":
        this.simulation.time.resume();
        this.broadcast({ type: "info", message: "resumed" });
        return false;
      case "setTimeScale":
        if (!Number.isFinite(message.scale) || message.scale < 0) {
          throw new Error("setTimeScale: scale must be a non-negative number");
        }
        this.simulation.time.setScale(message.scale);
        this.broadcast({ type: "info", message: `time scale = ${message.scale}` });
        return false;
      case "addBody":
        if (!message.body || typeof message.body.id !== "string") {
          throw new Error("addBody: missing body");
        }
        this.simulation.world.physics.addBody(Body.fromData(message.body));
        return true;
      default: {
        const exhaustive: never = message;
        throw new Error(`unknown command: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private broadcastSnapshot(): void {
    this.broadcast({
      type: "snapshot",
      timeSeconds: this.simulation.timeSeconds,
      steps: 0,
      bodies: this.simulation.world.physics.snapshot(),
    });
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }

  // --- REST ----------------------------------------------------------------

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") return this.json(res, 204, null);

    this.metrics.httpRequests += 1;
    const startedAt = Date.now();
    res.on("finish", () =>
      this.logger.debug("http", {
        method,
        url,
        status: res.statusCode,
        ms: Date.now() - startedAt,
      }),
    );

    try {
      if (method === "GET" && url === "/api/health") {
        return this.json(res, 200, {
          status: "ok",
          uptimeSeconds: (Date.now() - this.startedAt) / 1000,
          clients: this.wss.clients.size,
          ...this.worldInfo(),
        });
      }
      if (method === "GET" && url === "/api/metrics") {
        return this.json(res, 200, { ...this.metrics.snapshot(), world: this.worldInfo() });
      }
      if (method === "GET" && url === "/api/state") {
        return this.json(res, 200, {
          world: this.worldInfo(),
          bodies: this.simulation.world.physics.snapshot(),
        });
      }
      if (method === "GET" && url === "/api/save") {
        return this.json(res, 200, this.simulation.world.toSave());
      }
      if (method === "POST" && url === "/api/load") {
        const save = validateWorldSave(await this.readJson(req));
        this.simulation = new Simulation(World.fromSave(save));
        this.logger.info("world loaded", { bodies: this.simulation.world.physics.count });
        this.broadcastSnapshot();
        return this.json(res, 200, { status: "loaded", world: this.worldInfo() });
      }
      if (method === "POST" && url === "/api/command") {
        const command = validateClientMessage(await this.readJson(req));
        const broadcast = this.applyCommand(command);
        if (broadcast) this.broadcastSnapshot();
        return this.json(res, 200, { status: "ok", world: this.worldInfo() });
      }
      return this.json(res, 404, { error: "not found" });
    } catch (err) {
      return this.json(res, 400, {
        error: err instanceof Error ? err.message : "bad request",
      });
    }
  }

  private readJson(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve(text ? JSON.parse(text) : {});
        } catch {
          reject(new Error("invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end(body === null ? "" : JSON.stringify(body));
  }
}
