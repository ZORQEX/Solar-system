import { useEffect, useRef } from "react";
import { Renderer } from "../three/Renderer.ts";
import { Predictor } from "../net/predictor.ts";
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

    // The worker streams smoothed, predicted positions; render them only while
    // prediction is enabled (server snapshots drive the scene otherwise).
    const predictor = new Predictor((bodies) => {
      if (useUniverseStore.getState().predictionEnabled) renderer.setBodies(bodies);
    });

    // On every store change: keep the camera on the selection, and either feed
    // the predictor an authoritative resync or render the snapshot directly.
    const sync = () => {
      const s = useUniverseStore.getState();
      renderer.focus(s.selectedId);
      renderer.setSimTime(s.timeSeconds); // drives decorative satellites
      if (predictor.available() && s.predictionEnabled) {
        predictor.sync(s.bodies, s.timeScale, s.paused);
      } else {
        renderer.setBodies(s.bodies);
      }
    };
    sync();
    const unsubscribe = useUniverseStore.subscribe(sync);

    return () => {
      unsubscribe();
      predictor.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="scene-canvas" />;
}
