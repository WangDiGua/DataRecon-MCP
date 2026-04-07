import type { AppConfig } from "../config/index.js";

export type MemoryRow = Record<string, unknown>;

type Entry = {
  rows: MemoryRow[];
  bytes: number;
};

/**
 * In-memory snapshot store with row/byte caps and LRU eviction across sessions.
 */
export class SessionManager {
  private readonly entries = new Map<string, Entry>();
  /** Most-recent at end; used for eviction from front. */
  private readonly accessOrder: string[] = [];
  private totalRows = 0;
  private totalBytes = 0;

  constructor(
    private readonly maxRowsGlobal: number,
    private readonly maxBytesGlobal: number,
  ) {}

  static fromConfig(cfg: Pick<AppConfig, "MAX_SESSION_ROWS" | "MAX_SESSION_BYTES">): SessionManager {
    return new SessionManager(cfg.MAX_SESSION_ROWS, cfg.MAX_SESSION_BYTES);
  }

  private touch(sessionId: string): void {
    const i = this.accessOrder.indexOf(sessionId);
    if (i >= 0) {
      this.accessOrder.splice(i, 1);
    }
    this.accessOrder.push(sessionId);
  }

  private remove(sessionId: string): void {
    const e = this.entries.get(sessionId);
    if (!e) {
      return;
    }
    this.entries.delete(sessionId);
    this.totalRows -= e.rows.length;
    this.totalBytes -= e.bytes;
    const j = this.accessOrder.indexOf(sessionId);
    if (j >= 0) {
      this.accessOrder.splice(j, 1);
    }
  }

  private evictLru(): void {
    const victim = this.accessOrder.shift();
    if (victim) {
      this.remove(victim);
    }
  }

  estimateBytes(rows: MemoryRow[]): number {
    return Buffer.byteLength(JSON.stringify(rows), "utf8");
  }

  /**
   * Replace stored rows for sessionId. Enforces per-call row/byte caps and global quotas (LRU evict).
   */
  store(sessionId: string, rows: MemoryRow[]): void {
    if (rows.length > this.maxRowsGlobal) {
      throw new Error(
        `Rows ${rows.length} exceed MAX_SESSION_ROWS (${this.maxRowsGlobal})`,
      );
    }
    const bytes = this.estimateBytes(rows);
    if (bytes > this.maxBytesGlobal) {
      throw new Error(
        `Payload ${bytes} bytes exceeds MAX_SESSION_BYTES (${this.maxBytesGlobal})`,
      );
    }

    this.remove(sessionId);

    while (
      (this.totalRows + rows.length > this.maxRowsGlobal ||
        this.totalBytes + bytes > this.maxBytesGlobal) &&
      this.accessOrder.length > 0
    ) {
      this.evictLru();
    }

    if (
      this.totalRows + rows.length > this.maxRowsGlobal ||
      this.totalBytes + bytes > this.maxBytesGlobal
    ) {
      throw new Error("Session memory quota exceeded; evicted oldest sessions but still too large");
    }

    this.entries.set(sessionId, { rows, bytes });
    this.totalRows += rows.length;
    this.totalBytes += bytes;
    this.touch(sessionId);
  }

  getRows(sessionId: string): MemoryRow[] {
    const e = this.entries.get(sessionId);
    if (!e) {
      throw new Error(`Unknown session_id: ${sessionId}`);
    }
    this.touch(sessionId);
    return e.rows;
  }

  count(sessionId: string): number {
    return this.getRows(sessionId).length;
  }

  sum(sessionId: string, column: string): number {
    const rows = this.getRows(sessionId);
    let s = 0;
    for (const r of rows) {
      const v = r[column];
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isNaN(n)) {
        throw new Error(`Non-numeric value for sum on column ${column}`);
      }
      s += n;
    }
    return s;
  }

  avg(sessionId: string, column: string): number {
    const rows = this.getRows(sessionId);
    if (rows.length === 0) {
      return 0;
    }
    return this.sum(sessionId, column) / rows.length;
  }

  groupByCount(sessionId: string, column: string): Record<string, number> {
    const rows = this.getRows(sessionId);
    const out: Record<string, number> = {};
    for (const r of rows) {
      const key =
        r[column] === null || r[column] === undefined
          ? ""
          : String(r[column]);
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }
}

let singleton: SessionManager | undefined;

export function getSessionManager(cfg: Pick<AppConfig, "MAX_SESSION_ROWS" | "MAX_SESSION_BYTES">): SessionManager {
  if (!singleton) {
    singleton = SessionManager.fromConfig(cfg);
  }
  return singleton;
}

/** @internal */
export function resetSessionManagerForTests(): void {
  singleton = undefined;
}
