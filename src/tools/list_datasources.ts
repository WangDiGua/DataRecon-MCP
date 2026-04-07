import type { RowDataPacket } from "mysql2";
import { getPool } from "../database/connection.js";
import { loadConfig } from "../config/index.js";
import { SYSTEM_DBS } from "../utils/constants.js";

export async function runListDatasources(): Promise<{ databases: string[] }> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>("SHOW DATABASES");
  const banned = new Set(
    [
      ...SYSTEM_DBS.map((s) => s.toLowerCase()),
      ...loadConfig().DATASOURCE_DENYLIST.map((s) => s.toLowerCase()),
    ],
  );

  const databases: string[] = [];
  for (const row of rows) {
    const name = String((row as RowDataPacket).Database ?? "");
    if (!name) {
      continue;
    }
    if (banned.has(name.toLowerCase())) {
      continue;
    }
    databases.push(name);
  }

  return { databases };
}
