import { useEffect } from "react";
import { SceneView } from "./components/SceneView.tsx";
import { Hud } from "./components/Hud.tsx";
import { ControlPanel } from "./components/ControlPanel.tsx";
import { BodyList } from "./components/BodyList.tsx";
import { DetailsPanel } from "./components/DetailsPanel.tsx";
import { isWebGPUAvailable } from "./gpu/nbody-gpu.ts";
import { useUniverseStore } from "./stores/universeStore.ts";

function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  const host = typeof location !== "undefined" ? location.hostname : "localhost";
  const base = fromEnv ?? `ws://${host}:8080`;
  const token = import.meta.env.VITE_AUTH_TOKEN as string | undefined;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function App() {
  const connect = useUniverseStore((s) => s.connect);
  const disconnect = useUniverseStore((s) => s.disconnect);
  const setGpuAvailable = useUniverseStore((s) => s.setGpuAvailable);

  useEffect(() => {
    setGpuAvailable(isWebGPUAvailable());
    connect(serverUrl());
    return () => disconnect();
  }, [connect, disconnect, setGpuAvailable]);

  return (
    <div className="app">
      <SceneView />
      <Hud />
      <DetailsPanel />
      <BodyList />
      <ControlPanel />
    </div>
  );
}
