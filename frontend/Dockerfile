# 3D client. Build context is the repo root:
#   docker build -f frontend/Dockerfile --build-arg VITE_SERVER_URL=ws://localhost:8080 -t universe-web .
FROM node:24-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
# The frontend bundle (and its prediction worker) imports the shared package and
# the backend physics core, so both must be present at build time.
COPY shared ./shared
COPY backend ./backend
COPY frontend ./frontend
RUN npm ci

# Bake the server URL (and optional auth token) into the static bundle.
ARG VITE_SERVER_URL
ARG VITE_AUTH_TOKEN
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_AUTH_TOKEN=$VITE_AUTH_TOKEN
RUN npm run build:frontend

# Serve the static build with nginx (SPA fallback).
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
