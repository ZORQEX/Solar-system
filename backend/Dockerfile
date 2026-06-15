# Authoritative universe server. Build context is the repo root:
#   docker build -f backend/Dockerfile -t universe-server .
FROM node:24-slim

WORKDIR /app

# Install runtime deps only (the backend runs TypeScript natively — no build).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Source needed to run `npm run serve`.
COPY shared ./shared
COPY backend ./backend
COPY scripts ./scripts
COPY data ./data

ENV PORT=8080
# Optional: SCENARIO, SEED, LOG_LEVEL, LOG_JSON, AUTH_TOKEN
EXPOSE 8080

# Lightweight healthcheck against the open health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "serve"]
