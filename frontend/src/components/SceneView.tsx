import { useEffect, useRef } from "react";
import { Renderer } from "../three/Renderer.ts";
import { useUniverseStore } from "../stores/universeStore.ts";

/** Hosts the WebGL canvas and bridges store snapshots into the Three.js scene. */
export function SceneView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Renderer(canvas);
    renderer.setOnSelect((id) => useUniverseStore.getState().select(id));
    renderer.start();

    // Push the current snapshot, then react to every subsequent store change.
    const sync = () => {
      const state = useUniverseStore.getState();
      renderer.setBodies(state.bodies);
      renderer.focus(state.selectedId);
    };
    sync();
    const unsubscribe = useUniverseStore.subscribe(sync);

    return () => {
      unsubscribe();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="scene-canvas" />;
}
