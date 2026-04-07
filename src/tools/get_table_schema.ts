import type { RowDataPacket } from "mysql2";
import { getPool } from "../database/connection.js";
import { COLUMN_DENYLIST_KEYWORDS } from "../utils/constants.js";

function maskSensitive(
  columnName: string,
  dataType: string,
  columnType: string,
): { dataType: string; columnType: string } {
  const lower = columnName.toLowerCase();
  if (COLUMN_DENYLIST_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) {
    return { dataType: "HIDDEN", columnType: "HIDDEN" };
  }
  return { dataType, columnType };
}

export async function runGetTableSchema(
  dbName: string,
  tableName: string,
): Promise<{
  columns: Array<{
    name: string;
    dataType: string;
    columnType: string;
    isNullable: boolean;
    columnKey: string;
    comment: string | null;
    extra: string;
  }>;
  indexes: Record<string, { unique: boolean; columns: string[] }>;
}> {
  const pool = getPool();
  const [colRows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT, EXTRA, ORDINAL_POSITION
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [dbName, tableName],
  );

  const [statRows] = await pool.query<RowDataPacket[]>(
    `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [dbName, tableName],
  );

  const columns = colRows.map((row) => {
    const name = String(row.COLUMN_NAME);
    const { dataType, columnType } = maskSensitive(
      name,
      String(row.DATA_TYPE),
      String(row.COLUMN_TYPE),
    );
    return {
      name,
      dataType,
      columnType,
      isNullable: row.IS_NULLABLE === "YES",
      columnKey: row.COLUMN_KEY != null ? String(row.COLUMN_KEY) : "",
      comment: row.COLUMN_COMMENT != null ? String(row.COLUMN_COMMENT) : null,
      extra: row.EXTRA != null ? String(row.EXTRA) : "",
    };
  });

  const indexes: Record<string, { unique: boolean; columns: string[] }> = {};

  for (const row of statRows) {
    const iname = String(row.INDEX_NAME);
    const col = String(row.COLUMN_NAME);
    const unique = Number(row.NON_UNIQUE) === 0;
    if (!indexes[iname]) {
      indexes[iname] = { unique, columns: [] };
    }
    indexes[iname].columns.push(col);
  }

  return { columns, indexes };
}
