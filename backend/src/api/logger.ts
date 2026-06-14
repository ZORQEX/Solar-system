/**
 * Tiny structured logger — no dependencies. Levels gate output; metadata is
 * appended as `key=value` pairs (or full JSON when `json: true`). A custom
 * `sink` makes it trivial to capture output in tests.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export type LogMeta = Record<string, unknown>;

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  /** A logger that prefixes a sub-scope onto every line. */
  child(scope: string): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  scope?: string;
  json?: boolean;
  sink?: (line: string) => void;
}

function formatMeta(meta: LogMeta): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) parts.push(`${k}=${JSON.stringify(v)}`);
  return parts.length ? " " + parts.join(" ") : "";
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const threshold = LEVEL_ORDER[level];
  const scope = options.scope ?? "";
  const sink = options.sink ?? ((line: string) => console.log(line));
  const json = options.json ?? false;

  const log = (lvl: LogLevel, message: string, meta?: LogMeta): void => {
    if (LEVEL_ORDER[lvl] < threshold) return;
    const time = new Date().toISOString();
    if (json) {
      sink(JSON.stringify({ time, level: lvl, scope: scope || undefined, message, ...meta }));
    } else {
      const scopeStr = scope ? ` ${scope}` : "";
      sink(`${time} ${lvl.toUpperCase().padEnd(5)}${scopeStr} ${message}${meta ? formatMeta(meta) : ""}`);
    }
  };

  return {
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    child: (childScope) =>
      createLogger({
        level,
        json,
        sink,
        scope: scope ? `${scope}:${childScope}` : childScope,
      }),
  };
}

/** A logger that drops everything — handy default for libraries and tests. */
export const silentLogger: Logger = createLogger({ level: "error", sink: () => {} });
