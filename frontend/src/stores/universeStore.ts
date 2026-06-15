import { create } from "zustand";
import { Connection } from "../net/connection.ts";
import { fetchSave, httpBaseFromWs, postLoad } from "../net/rest.ts";
import type { BodyData, ServerMessage } from "../shared.ts";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface UniverseState {
  status: ConnectionStatus;
  serverUrl: string;
  worldName: string;
  timeSeconds: number;
  bodies: BodyData[];
  selectedId: string | null;
  paused: boolean;
  timeScale: number;
  observers: number;
  predictionEnabled: boolean;
  gpuAvailable: boolean;
  lastInfo: string;

  // actions
  connect: (url: string) => void;
  reconnect: () => void;
  disconnect: () => void;
  select: (id: string | null) => void;
  setTimeScale: (scale: number) => void;
  pause: () => void;
  resume: () => void;
  resetTime: () => void;
  spawnAsteroid: () => void;
  togglePrediction: () => void;
  setGpuAvailable: (available: boolean) => void;
  fetchSave: () => Promise<unknown>;
  loadWorld: (save: unknown) => Promise<void>;
}

/** Internal, non-reactive connection handle + auto-reconnect bookkeeping. */
let connection: Connection | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
const RECONNECT_DELAY_MS = 2000;

export const useUniverseStore = create<UniverseState>((set, get) => {
  const handleServerMessage = (message: ServerMessage): void => {
    switch (message.type) {
      case "welcome":
        set({
          worldName: message.world.name,
          timeSeconds: message.world.timeSeconds,
          bodies: message.snapshot,
        });
        break;
      case "snapshot":
        set({ timeSeconds: message.timeSeconds, bodies: message.bodies });
        break;
      case "info":
        set({ lastInfo: message.message });
        if (message.message === "paused") set({ paused: true });
        if (message.message === "resumed") set({ paused: false });
        break;
      case "error":
        set({ lastInfo: `error: ${message.message}` });
        break;
      case "presence":
        set({ observers: message.clients });
        break;
      case "ack":
        break;
    }
  };

  return {
    status: "disconnected",
    serverUrl: "",
    worldName: "—",
    timeSeconds: 0,
    bodies: [],
    selectedId: null,
    paused: false,
    timeScale: 1,
    observers: 0,
    predictionEnabled: true,
    gpuAvailable: false,
    lastInfo: "",

    connect: (url) => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      intentionalClose = false;
      connection?.close();
      set({ status: "connecting", serverUrl: url });
      connection = new Connection(url, {
        onMessage: handleServerMessage,
        onOpen: () => set({ status: "connected" }),
        onClose: () => {
          set({ status: "disconnected" });
          // Auto-reconnect unless the user disconnected on purpose.
          if (!intentionalClose && reconnectTimer === null) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              get().connect(url);
            }, RECONNECT_DELAY_MS);
          }
        },
      });
    },

    reconnect: () => {
      const { serverUrl } = get();
      if (serverUrl) get().connect(serverUrl);
    },

    disconnect: () => {
      intentionalClose = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connection?.close();
      connection = null;
      set({ status: "disconnected" });
    },

    select: (id) => set({ selectedId: id }),

    togglePrediction: () =>
      set((s) => ({ predictionEnabled: !s.predictionEnabled })),

    setGpuAvailable: (available) => set({ gpuAvailable: available }),

    setTimeScale: (scale) => {
      set({ timeScale: scale });
      connection?.send({ type: "setTimeScale", scale });
    },

    pause: () => {
      set({ paused: true });
      connection?.send({ type: "pause" });
    },

    resume: () => {
      set({ paused: false });
      connection?.send({ type: "resume" });
    },

    resetTime: () => {
      connection?.send({ type: "resetTime" });
    },

    fetchSave: async () => {
      const { serverUrl } = get();
      if (!serverUrl) throw new Error("not connected");
      return fetchSave(httpBaseFromWs(serverUrl));
    },

    loadWorld: async (save) => {
      const { serverUrl } = get();
      if (!serverUrl) throw new Error("not connected");
      try {
        await postLoad(httpBaseFromWs(serverUrl), save);
        set({ lastInfo: "world loaded" });
      } catch (err) {
        set({
          lastInfo: `load failed: ${err instanceof Error ? err.message : err}`,
        });
        throw err;
      }
    },

    // A small "intervention": fling a rogue asteroid into the system.
    spawnAsteroid: () => {
      const { bodies } = get();
      // Place it near the outskirts of whatever is currently loaded.
      let maxR = 1.5e11;
      for (const b of bodies) {
        const r = Math.hypot(b.position.x, b.position.y, b.position.z);
        if (r > maxR) maxR = r;
      }
      const angle = Math.random() * Math.PI * 2;
      connection?.send({
        type: "addBody",
        body: {
          id: `asteroid-${Date.now()}`,
          type: "asteroid",
          mass: 1e21,
          radius: 5e5,
          position: {
            x: Math.cos(angle) * maxR * 1.2,
            y: Math.sin(angle) * maxR * 1.2,
            z: 0,
          },
          velocity: {
            x: -Math.sin(angle) * 1e4,
            y: Math.cos(angle) * 1e4,
            z: 0,
          },
          color: "#cccccc",
        },
      });
    },
  };
});
