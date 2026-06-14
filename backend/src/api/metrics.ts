/**
 * In-process counters for monitoring. Exposed via `GET /api/metrics`. Cheap to
 * read; no external dependencies. (A real deployment would scrape these into
 * Prometheus/StatsD, but the shape is all here.)
 */
export interface MetricsSnapshot {
  uptimeSeconds: number;
  ticks: number;
  commandsApplied: number;
  commandErrors: number;
  httpRequests: number;
  wsConnectionsTotal: number;
  wsActive: number;
}

export class Metrics {
  private readonly startedAt = Date.now();
  ticks = 0;
  commandsApplied = 0;
  commandErrors = 0;
  httpRequests = 0;
  wsConnectionsTotal = 0;
  wsActive = 0;

  onConnect(): void {
    this.wsConnectionsTotal += 1;
    this.wsActive += 1;
  }

  onDisconnect(): void {
    this.wsActive = Math.max(0, this.wsActive - 1);
  }

  snapshot(): MetricsSnapshot {
    return {
      uptimeSeconds: (Date.now() - this.startedAt) / 1000,
      ticks: this.ticks,
      commandsApplied: this.commandsApplied,
      commandErrors: this.commandErrors,
      httpRequests: this.httpRequests,
      wsConnectionsTotal: this.wsConnectionsTotal,
      wsActive: this.wsActive,
    };
  }
}
