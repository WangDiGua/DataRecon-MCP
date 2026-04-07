import type { RowDataPacket } from "mysql2";
import { getPool } from "../database/connection.js";

export async function runExecuteQuery(
  dbName: string,
  sql: string,
  limit: number,
  offset: number,
): Promise<{
  rows: RowDataPacket[];
  pagination: { limit: number; offset: number; returned: number };
}> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.query("USE ??", [dbName]);
    const trimmed = sql.trim().replace(/;+\s*$/u, "");
    const [rows] = await conn.query<RowDataPacket[]>(
      `${trimmed} LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    const list = rows as RowDataPacket[];
    return {
      rows: list,
      pagination: { limit, offset, returned: list.length },
    };
  } finally {
    conn.release();
  }
}
