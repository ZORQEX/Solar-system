import { useUniverseStore } from "../stores/universeStore.ts";
import { TIME_SCALES, type TimeScaleName } from "../shared.ts";

const SCALE_OPTIONS = Object.keys(TIME_SCALES) as TimeScaleName[];

/** Bottom playback controls: pause, time-scale selector, and an intervention. */
export function ControlPanel() {
  const paused = useUniverseStore((s) => s.paused);
  const timeScale = useUniverseStore((s) => s.timeScale);
  const pause = useUniverseStore((s) => s.pause);
  const resume = useUniverseStore((s) => s.resume);
  const setTimeScale = useUniverseStore((s) => s.setTimeScale);
  const spawnAsteroid = useUniverseStore((s) => s.spawnAsteroid);

  return (
    <div className="controls">
      <button onClick={() => (paused ? resume() : pause())}>
        {paused ? "▶ Resume" : "⏸ Pause"}
      </button>

      <label className="controls__scale">
        speed
        <select
          value={timeScale}
          onChange={(e) => setTimeScale(Number(e.target.value))}
        >
          {SCALE_OPTIONS.map((name) => (
            <option key={name} value={TIME_SCALES[name]}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <button onClick={() => spawnAsteroid()}>☄ Fling asteroid</button>
    </div>
  );
}
