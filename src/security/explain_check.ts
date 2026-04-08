import type { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Rejects queries whose EXPLAIN row estimates exceed the configured ceiling.
 */
export async function assertExplainRowEstimate(
  pool: Pool,
  dbName: string,
  sqlForExecution: string,
  maxExplainRows: number,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query("USE ??", [dbName]);
    const [rows] = await conn.query<RowDataPacket[]>(
      `EXPLAIN FORMAT=TRADITIONAL ${sqlForExecution}`,
    );
    let maxSeen = 0;
    for (const row of rows) {
      const r = row.rows;
      if (r != null && r !== "") {
        const n = Number(r);
        if (!Number.isNaN(n)) {
          maxSeen = Math.max(maxSeen, n);
        }
      }
    }
    if (maxSeen > maxExplainRows) {
      throw new Error(
        [
          `SQL 执行前检查失败 [EXPLAIN_ROW_CEILING]：EXPLAIN 估算扫描行数约为 ${maxSeen}，超过允许上限 ${maxExplainRows}。`,
          "原因：防止可能过重的全表扫描或大结果集，保护数据库与接口超时。",
          "处理：为条件列补索引、缩小 WHERE 时间/范围、避免前置 SELECT * 大表；或联系管理员提高 MAX_EXPLAIN_ROWS（权衡风险）。",
        ].join(" "),
      );
    }
  } finally {
    conn.release();
  }
}
