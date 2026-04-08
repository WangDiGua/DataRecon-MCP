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
        [
          `会话内存失败 [SESSION_ROWS_SINGLE_CALL_EXCEEDED]：本次传入 ${rows.length} 行，超过单次上限 MAX_SESSION_ROWS=${this.maxRowsGlobal}。`,
          "处理：减少 rows 条数、分多次 store_to_memory，或请管理员提高 MAX_SESSION_ROWS（注意进程内存）。",
        ].join(" "),
      );
    }
    const bytes = this.estimateBytes(rows);
    if (bytes > this.maxBytesGlobal) {
      throw new Error(
        [
          `会话内存失败 [SESSION_BYTES_SINGLE_CALL_EXCEEDED]：本次估算约 ${bytes} 字节，超过单次上限 MAX_SESSION_BYTES=${this.maxBytesGlobal}。`,
          "处理：减少列维数据量、分批写入，或请管理员提高 MAX_SESSION_BYTES。",
        ].join(" "),
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
      throw new Error(
        [
          "会话内存失败 [SESSION_GLOBAL_QUOTA_AFTER_EVICT]：在按 LRU 淘汰最旧会话后，全局行数/字节配额仍不足以容纳本次写入。",
          `当前全局约 ${this.totalRows} 行 / ${this.totalBytes} 字节；本次需再增 ${rows.length} 行 / ${bytes} 字节；上限为 ${this.maxRowsGlobal} 行、${this.maxBytesGlobal} 字节。`,
          "处理：清空不需要的会话、缩小单次 rows，或请管理员提高配额。",
        ].join(" "),
      );
    }

    this.entries.set(sessionId, { rows, bytes });
    this.totalRows += rows.length;
    this.totalBytes += bytes;
    this.touch(sessionId);
  }

  getRows(sessionId: string): MemoryRow[] {
    const e = this.entries.get(sessionId);
    if (!e) {
      throw new Error(
        [
          `会话内存失败 [SESSION_UNKNOWN_ID]：不存在会话「${sessionId}」。`,
          "原因：ID 拼写错误、会话已被 LRU 淘汰、或尚未执行过 store_to_memory。",
          "处理：先用 store_to_memory 拿到 session_id 再调用 analyze_memory；或重新拉数入库。",
        ].join(" "),
      );
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
        throw new Error(
          [
            `会话聚合失败 [SESSION_SUM_NON_NUMERIC]：列「${column}」上存在无法转为数字的值（包含 null/空串/非数字字符串等）。`,
            "处理：先在内存数据中清洗该列，或改用 group_by 统计分布；仅对纯数值列使用 sum/avg。",
          ].join(" "),
        );
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
