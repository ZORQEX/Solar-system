import { useUniverseStore } from "../stores/universeStore.ts";
import { SECONDS_PER_YEAR, SECONDS_PER_DAY } from "../shared.ts";

function formatSimTime(seconds: number): string {
  if (seconds >= SECONDS_PER_YEAR) return `${(seconds / SECONDS_PER_YEAR).toFixed(2)} yr`;
  if (seconds >= SECONDS_PER_DAY) return `${(seconds / SECONDS_PER_DAY).toFixed(2)} d`;
  return `${seconds.toFixed(0)} s`;
}

const STATUS_LABEL = {
  disconnected: "● offline",
  connecting: "● connecting…",
  connected: "● live",
} as const;

/** Top-left heads-up display: world name, connection, sim clock, body count. */
export function Hud() {
  const status = useUniverseStore((s) => s.status);
  const worldName = useUniverseStore((s) => s.worldName);
  const timeSeconds = useUniverseStore((s) => s.timeSeconds);
  const bodyCount = useUniverseStore((s) => s.bodies.length);
  const observers = useUniverseStore((s) => s.observers);
  const gpuAvailable = useUniverseStore((s) => s.gpuAvailable);
  const lastInfo = useUniverseStore((s) => s.lastInfo);
  const reconnect = useUniverseStore((s) => s.reconnect);

  return (
    <div className="hud">
      <h1>{worldName}</h1>
      <div className={`status status--${status}`}>
        {STATUS_LABEL[status]}
        {status === "disconnected" && (
          <button className="hud__reconnect" onClick={() => reconnect()}>
            reconnect
          </button>
        )}
      </div>
      <dl>
        <dt>sim time</dt>
        <dd>{formatSimTime(timeSeconds)}</dd>
        <dt>bodies</dt>
        <dd>{bodyCount}</dd>
        <dt>observers</dt>
        <dd>{observers}</dd>
        <dt>WebGPU</dt>
        <dd>{gpuAvailable ? "yes" : "no"}</dd>
      </dl>
      {lastInfo && <div className="hud__info">{lastInfo}</div>}
    </div>
  );
}
