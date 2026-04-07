/**
 * Injects MySQL 8 optimizer hint for server-side execution timeout (milliseconds).
 * @see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
 */
export function injectMaxExecutionTimeMs(sql: string, ms: number): string {
  const t = sql.trim();
  const capped = Math.max(0, Math.floor(ms));
  if (!/^SELECT\b/i.test(t)) {
    throw new Error("Expected SELECT");
  }
  return t.replace(/^SELECT\b/i, `SELECT /*+ MAX_EXECUTION_TIME(${capped}) */`);
}
