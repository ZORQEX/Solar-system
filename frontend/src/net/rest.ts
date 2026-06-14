/** REST helpers for save/load. The server's HTTP origin is the WebSocket URL
 * with the scheme swapped (ws→http, wss→https). */

export function httpBaseFromWs(wsUrl: string): string {
  if (wsUrl.startsWith("wss://")) return "https://" + wsUrl.slice("wss://".length);
  if (wsUrl.startsWith("ws://")) return "http://" + wsUrl.slice("ws://".length);
  return wsUrl;
}

/** Fetch the full world save (GET /api/save). */
export async function fetchSave(httpBase: string): Promise<unknown> {
  const res = await fetch(`${httpBase}/api/save`);
  if (!res.ok) throw new Error(`save failed: HTTP ${res.status}`);
  return res.json();
}

/** Replace the live world with a save (POST /api/load). */
export async function postLoad(httpBase: string, save: unknown): Promise<void> {
  const res = await fetch(`${httpBase}/api/load`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(save),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `load failed: HTTP ${res.status}`);
  }
}
