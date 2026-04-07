import type { RowDataPacket } from "mysql2";
import { getPool } from "../database/connection.js";
import type { AppConfig } from "../config/index.js";
import { assertSelectOnly } from "../security/ast_parser.js";
import { runSqlPreflight } from "../security/sql_validator.js";
import { assertExplainRowEstimate } from "../security/explain_check.js";
import { injectMaxExecutionTimeMs } from "../security/sql_preprocess.js";
import { filterMysqlError } from "../security/error_filter.js";

export type ExecuteQuerySecurityConfig = Pick<
  AppConfig,
  "MAX_EXPLAIN_ROWS" | "MAX_EXECUTION_TIME"
>;

export async function runExecuteQuery(
  dbName: string,
  sql: string,
  limit: number,
  offset: number,
  security: ExecuteQuerySecurityConfig,
): Promise<{
  rows: RowDataPacket[];
  pagination: { limit: number; offset: number; returned: number };
}> {
  runSqlPreflight(sql);
  const validatedSql = assertSelectOnly(sql);

  const pool = getPool();
  const withHint = injectMaxExecutionTimeMs(
    validatedSql,
    security.MAX_EXECUTION_TIME,
  );
  const lim = Number(limit);
  const off = Number(offset);
  const execSql = `${withHint} LIMIT ${lim} OFFSET ${off}`;

  await assertExplainRowEstimate(
    pool,
    dbName,
    execSql,
    security.MAX_EXPLAIN_ROWS,
  );

  const conn = await pool.getConnection();
  try {
    await conn.query("USE ??", [dbName]);
    try {
      const [rows] = await conn.query<RowDataPacket[]>(execSql);
      const list = rows as RowDataPacket[];
      return {
        rows: list,
        pagination: { limit: lim, offset: off, returned: list.length },
      };
    } catch (err) {
      throw filterMysqlError(err);
    }
  } finally {
    conn.release();
  }
}
