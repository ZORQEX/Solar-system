import { useUniverseStore } from "../stores/universeStore.ts";
import { AU } from "../shared.ts";

function magnitude(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** Detail card for the currently selected body (click one in the list or scene). */
export function DetailsPanel() {
  const selectedId = useUniverseStore((s) => s.selectedId);
  const body = useUniverseStore((s) => s.bodies.find((b) => b.id === s.selectedId));
  const select = useUniverseStore((s) => s.select);

  if (!selectedId || !body) return null;

  const distanceAU = magnitude(body.position) / AU;
  const speedKmS = magnitude(body.velocity) / 1000;

  return (
    <div className="details">
      <div className="details__head">
        <span className="swatch" style={{ background: body.color ?? "#888" }} />
        <strong>{body.name ?? body.id}</strong>
        <button className="details__close" onClick={() => select(null)}>
          ✕
        </button>
      </div>
      <dl>
        <dt>type</dt>
        <dd>{body.type}</dd>
        <dt>mass</dt>
        <dd>{body.mass.toExponential(3)} kg</dd>
        <dt>radius</dt>
        <dd>{(body.radius / 1000).toLocaleString()} km</dd>
        <dt>distance</dt>
        <dd>{distanceAU.toFixed(4)} AU</dd>
        <dt>speed</dt>
        <dd>{speedKmS.toFixed(3)} km/s</dd>
      </dl>
    </div>
  );
}
