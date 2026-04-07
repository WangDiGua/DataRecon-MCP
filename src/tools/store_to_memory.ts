import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/index.js";
import { getSessionManager, type MemoryRow } from "../memory/session_manager.js";

export function runStoreToMemory(
  sessionId: string | undefined,
  rows: MemoryRow[],
): { session_id: string; stored_rows: number } {
  const id = sessionId?.trim() || randomUUID();
  const sm = getSessionManager(loadConfig());
  sm.store(id, rows);
  return { session_id: id, stored_rows: rows.length };
}
