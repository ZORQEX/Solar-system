import { useUniverseStore } from "../stores/universeStore.ts";

/** Right-hand list of bodies; click to focus the camera on one. */
export function BodyList() {
  const bodies = useUniverseStore((s) => s.bodies);
  const selectedId = useUniverseStore((s) => s.selectedId);
  const select = useUniverseStore((s) => s.select);

  return (
    <div className="body-list">
      <h2>Bodies ({bodies.length})</h2>
      <ul>
        {bodies.map((b) => (
          <li
            key={b.id}
            className={b.id === selectedId ? "selected" : ""}
            onClick={() => select(b.id === selectedId ? null : b.id)}
          >
            <span className="swatch" style={{ background: b.color ?? "#888" }} />
            <span className="name">{b.name ?? b.id}</span>
            <span className="type">{b.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
