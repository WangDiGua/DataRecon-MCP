/**
 * Injects MySQL 8 optimizer hint for server-side execution timeout (milliseconds).
 * @see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
 */
export function injectMaxExecutionTimeMs(sql: string, ms: number): string {
  const t = sql.trim();
  const capped = Math.max(0, Math.floor(ms));
  if (!/^SELECT\b/i.test(t)) {
    throw new Error(
      [
        "SQL 预处理失败 [EXPECTED_SELECT_PREFIX]：准备在语句前注入 MAX_EXECUTION_TIME 提示时，要求 sql 必须以 SELECT 开头（可跟空白）。",
        `当前开头片段（前 80 字符）：${t.slice(0, 80)}${t.length > 80 ? "…" : ""}`,
        "说明：若你看到本条而 SQL 明明是 SELECT，请检查是否多了 BOM、不可见字符或把关键字写成了小语种/全角拼写。",
      ].join(" "),
    );
  }
  return t.replace(/^SELECT\b/i, `SELECT /*+ MAX_EXECUTION_TIME(${capped}) */`);
}
