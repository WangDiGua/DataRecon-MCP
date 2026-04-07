const MAX_AUDIT_SQL_LENGTH = 2000;

let originalLog: typeof console.log | undefined;
let originalInfo: typeof console.info | undefined;

function writeJsonLine(record: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify(record)}\n`);
}

export function logInfo(msg: string, meta?: Record<string, unknown>): void {
  writeJsonLine({
    level: "info",
    msg,
    time: new Date().toISOString(),
    ...(meta ?? {}),
  });
}

export function logError(msg: string, meta?: Record<string, unknown>): void {
  writeJsonLine({
    level: "error",
    msg,
    time: new Date().toISOString(),
    ...(meta ?? {}),
  });
}

export function auditQuery(sql: string, meta?: Record<string, unknown>): void {
  const truncated =
    sql.length > MAX_AUDIT_SQL_LENGTH
      ? sql.slice(0, MAX_AUDIT_SQL_LENGTH)
      : sql;
  const { sessionId, traceId, ...rest } = meta ?? {};
  writeJsonLine({
    type: "audit.query",
    sql: truncated,
    time: new Date().toISOString(),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(traceId !== undefined ? { traceId } : {}),
    ...rest,
  });
}

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
}

/**
 * Redirects console.log / console.info to structured stderr JSON (logInfo).
 * Safe: logInfo uses process.stderr.write only, not console.*.
 */
export function initLogger(): void {
  if (originalLog !== undefined) {
    return;
  }
  originalLog = console.log.bind(console);
  originalInfo = console.info.bind(console);

  console.log = (...args: unknown[]) => {
    logInfo(formatConsoleArgs(args));
  };
  console.info = (...args: unknown[]) => {
    logInfo(formatConsoleArgs(args));
  };
}

/** Restores console.log / console.info; for tests or shutdown. */
export function resetLogger(): void {
  if (originalLog !== undefined) {
    console.log = originalLog;
  }
  if (originalInfo !== undefined) {
    console.info = originalInfo;
  }
  originalLog = undefined;
  originalInfo = undefined;
}
