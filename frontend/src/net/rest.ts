/** REST helpers for save/load. The server's HTTP origin is the WebSocket URL
 * with the scheme swapped (ws→http, wss→https). */

export function httpBaseFromWs(wsUrl: string): string {
  // Drop any query (e.g. ?token=…) before swapping the scheme.
  const noQuery = wsUrl.split("?")[0] ?? wsUrl;
  if (noQuery.startsWith("wss://")) return "https://" + noQuery.slice("wss://".length);
  if (noQuery.startsWith("ws://")) return "http://" + noQuery.slice("ws://".length);
  return noQuery;
}

/** Optional bearer auth header, from VITE_AUTH_TOKEN. */
export function authHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_AUTH_TOKEN as string | undefined;
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Fetch the full world save (GET /api/save). */
export async function fetchSave(httpBase: string): Promise<unknown> {
  const res = await fetch(`${httpBase}/api/save`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`save failed: HTTP ${res.status}`);
  return res.json();
}

/** Replace the live world with a save (POST /api/load). */
export async function postLoad(httpBase: string, save: unknown): Promise<void> {
  const res = await fetch(`${httpBase}/api/load`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(save),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `load failed: HTTP ${res.status}`);
  }
}
