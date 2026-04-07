import type { RowDataPacket } from "mysql2";
import { getPool } from "../database/connection.js";
import { TABLE_NAME_DENYLIST_KEYWORDS } from "../utils/constants.js";

function isSensitiveTableName(name: string): boolean {
  const lower = name.toLowerCase();
  return TABLE_NAME_DENYLIST_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

export async function runGetTableList(
  dbName: string,
): Promise<{ tables: Array<{ name: string; comment: string | null }> }> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME, TABLE_COMMENT
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [dbName],
  );

  const tables: Array<{ name: string; comment: string | null }> = [];
  for (const row of rows) {
    const name = String(row.TABLE_NAME);
    if (isSensitiveTableName(name)) {
      continue;
    }
    tables.push({
      name,
      comment: row.TABLE_COMMENT != null ? String(row.TABLE_COMMENT) : null,
    });
  }

  return { tables };
}
