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
        `EXPLAIN estimates ${maxSeen} rows scanned; maximum allowed is ${maxExplainRows}`,
      );
    }
  } finally {
    conn.release();
  }
}
