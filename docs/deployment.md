# Deployment

## Local (no containers)

```bash
npm install
npm run serve       # server  → http://localhost:8080
npm run frontend    # client  → http://localhost:5173
```

Server env vars: `PORT`, `SCENARIO` (a name under `data/`), `SEED` (generate a
system instead of loading a file), `LOG_LEVEL`, `LOG_JSON=1`, `AUTH_TOKEN`.
Client build vars: `VITE_SERVER_URL`, `VITE_AUTH_TOKEN`.

## Docker

Two images: the authoritative server (Node) and the static client (nginx). Both
build from the repo root.

```bash
docker compose up --build
# client → http://localhost:8081   server → http://localhost:8080
```

`docker-compose.yml` wires them together and exposes the common knobs:

- `server.environment`: `SCENARIO`, `LOG_LEVEL`, optional `AUTH_TOKEN`.
- `web.build.args`: `VITE_SERVER_URL` (must point at the server), optional
  `VITE_AUTH_TOKEN` (must match the server's `AUTH_TOKEN`).

Build images individually:

```bash
docker build -f backend/Dockerfile -t universe-server .
docker build -f frontend/Dockerfile --build-arg VITE_SERVER_URL=ws://localhost:8080 -t universe-web .
```

Notes:

- The backend installs runtime deps only (`npm ci --omit=dev`) and runs the
  TypeScript sources natively — no build step.
- The frontend build needs `shared/` **and** `backend/` present (the prediction
  worker bundles the physics core), then serves the static `dist/` via nginx
  with SPA fallback.
- The server image ships a `HEALTHCHECK` hitting `/api/health`.
- For TLS / multiple replicas, put both behind a reverse proxy and use
  `wss://`/`https://` URLs; the server already sends permissive CORS.
