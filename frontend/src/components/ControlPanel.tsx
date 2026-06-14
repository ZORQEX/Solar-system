import { useRef } from "react";
import { useUniverseStore } from "../stores/universeStore.ts";
import { TIME_SCALES, type TimeScaleName } from "../shared.ts";

const SCALE_OPTIONS = Object.keys(TIME_SCALES) as TimeScaleName[];

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bottom controls: pause, time scale, intervention, and save/load. */
export function ControlPanel() {
  const paused = useUniverseStore((s) => s.paused);
  const timeScale = useUniverseStore((s) => s.timeScale);
  const pause = useUniverseStore((s) => s.pause);
  const resume = useUniverseStore((s) => s.resume);
  const setTimeScale = useUniverseStore((s) => s.setTimeScale);
  const spawnAsteroid = useUniverseStore((s) => s.spawnAsteroid);
  const fetchSave = useUniverseStore((s) => s.fetchSave);
  const loadWorld = useUniverseStore((s) => s.loadWorld);

  const fileInput = useRef<HTMLInputElement>(null);

  const onSave = async () => {
    try {
      const save = await fetchSave();
      downloadJson(`universe-${Date.now()}.json`, save);
    } catch {
      /* surfaced via store lastInfo / handled below */
    }
  };

  const onLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const save = JSON.parse(await file.text());
      await loadWorld(save);
    } catch {
      /* lastInfo already set by loadWorld; JSON parse errors ignored visually */
    }
  };

  return (
    <div className="controls">
      <button onClick={() => (paused ? resume() : pause())}>
        {paused ? "▶ Resume" : "⏸ Pause"}
      </button>

      <label className="controls__scale">
        speed
        <select value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))}>
          {SCALE_OPTIONS.map((name) => (
            <option key={name} value={TIME_SCALES[name]}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <button onClick={() => spawnAsteroid()}>☄ Fling asteroid</button>

      <span className="controls__sep" />

      <button onClick={() => void onSave()}>💾 Save</button>
      <button onClick={() => fileInput.current?.click()}>📂 Load</button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => void onLoadFile(e)}
      />
    </div>
  );
}
