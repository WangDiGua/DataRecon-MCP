import { loadConfig } from "../config/index.js";
import { getSessionManager } from "../memory/session_manager.js";

export type AnalyzeOp = "count" | "sum" | "avg" | "group_by";

export function runAnalyzeMemory(
  sessionId: string,
  op: AnalyzeOp,
  column?: string,
): unknown {
  const sm = getSessionManager(loadConfig());
  switch (op) {
    case "count":
      return { count: sm.count(sessionId) };
    case "sum": {
      if (!column) {
        throw new Error("column is required for sum");
      }
      return { sum: sm.sum(sessionId, column) };
    }
    case "avg": {
      if (!column) {
        throw new Error("column is required for avg");
      }
      return { avg: sm.avg(sessionId, column) };
    }
    case "group_by": {
      if (!column) {
        throw new Error("column is required for group_by");
      }
      return { groups: sm.groupByCount(sessionId, column) };
    }
  }
}
