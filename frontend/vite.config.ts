import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client talks to the authoritative server over WebSocket. Override the URL
// at build/dev time with VITE_SERVER_URL (defaults to ws://<host>:8080).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
