import { useEffect } from "react";
import { SceneView } from "./components/SceneView.tsx";
import { Hud } from "./components/Hud.tsx";
import { ControlPanel } from "./components/ControlPanel.tsx";
import { BodyList } from "./components/BodyList.tsx";
import { useUniverseStore } from "./stores/universeStore.ts";

function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const host = typeof location !== "undefined" ? location.hostname : "localhost";
  return `ws://${host}:8080`;
}

export function App() {
  const connect = useUniverseStore((s) => s.connect);
  const disconnect = useUniverseStore((s) => s.disconnect);

  useEffect(() => {
    connect(serverUrl());
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="app">
      <SceneView />
      <Hud />
      <BodyList />
      <ControlPanel />
    </div>
  );
}
