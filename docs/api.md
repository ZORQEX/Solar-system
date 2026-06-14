# Server API

The authoritative server ([`api/server.ts`](../backend/src/api/server.ts)) is one
`http.Server` with a WebSocket server attached. Start it with `npm run serve`
(`PORT`, `SEED` env vars). All responses send permissive CORS headers.

Protocol types and the version live in
[`shared/src/protocol.ts`](../shared/src/protocol.ts) (`PROTOCOL_VERSION = 1`).
Every untrusted input is validated ([`shared/src/validation.ts`](../shared/src/validation.ts));
invalid input yields a `400` (REST) or an `error` message (WebSocket), never a crash.

## REST

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ status, uptimeSeconds, clients, name, timeSeconds, bodyCount }` |
| GET | `/api/state` | — | `{ world: WorldInfo, bodies: BodyData[] }` |
| GET | `/api/save` | — | `WorldSave` (full serializable world) |
| POST | `/api/load` | `WorldSave` | `{ status: "loaded", world: WorldInfo }` |
| POST | `/api/command` | `ClientMessage` | `{ status: "ok", world: WorldInfo }` |
| OPTIONS | * | — | `204` (CORS preflight) |

Errors return `4xx` with `{ "error": "<message>" }`. `POST /api/load` replaces
the live world and broadcasts a fresh snapshot to all WebSocket clients.

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/save > my-universe.json
curl -X POST http://localhost:8080/api/load -H 'content-type: application/json' \
     --data @my-universe.json
```

## WebSocket

Connect to `ws://<host>:<port>`. The server pushes one `welcome` immediately,
then a `snapshot` on every tick and after any state-changing command.

### Server → client (`ServerMessage`)

```ts
{ type: "welcome", protocol: number, clientId: string,
  world: WorldInfo, snapshot: BodyData[] }
{ type: "snapshot", timeSeconds: number, steps: number, bodies: BodyData[] }
{ type: "info",  message: string }     // e.g. "paused", "time scale = 86400"
{ type: "ack",   command: string }     // acknowledges a received command
{ type: "error", message: string }     // validation / parse failure
{ type: "presence", clients: number }  // observer count, on every join/leave
```

### Client → server (`ClientMessage`)

```ts
{ type: "requestState" }               // server replies with a snapshot to you
{ type: "pause" }
{ type: "resume" }
{ type: "setTimeScale", scale: number } // sim seconds per real second, >= 0
{ type: "addBody", body: BodyData }     // intervene: inject a body
```

`scale` values map to the named [time scales](scaling.md#multi-scale-time)
(`TIME_SCALES` in `shared/`). A bad command (`scale` negative/non-numeric,
unknown `type`, malformed `body`) returns an `error` and changes nothing.

### Example session

```
S→C  { "type": "welcome", "protocol": 1, "clientId": "c1", "world": {…}, "snapshot": [...] }
C→S  { "type": "setTimeScale", "scale": 86400 }
S→C  { "type": "ack", "command": "setTimeScale" }
S→C  { "type": "info", "message": "time scale = 86400" }
S→C  { "type": "snapshot", "timeSeconds": 86400, "steps": 24, "bodies": [...] }   // each tick
```
