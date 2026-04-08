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
        throw new Error(
          [
            "analyze_memory 参数错误 [ANALYZE_MEMORY_COLUMN_REQUIRED_SUM]：op=sum 时必须提供 column。",
            "处理：传入要求和的数值列名，例如先前 execute_query 结果里的字段名。",
          ].join(" "),
        );
      }
      return { sum: sm.sum(sessionId, column) };
    }
    case "avg": {
      if (!column) {
        throw new Error(
          [
            "analyze_memory 参数错误 [ANALYZE_MEMORY_COLUMN_REQUIRED_AVG]：op=avg 时必须提供 column。",
            "处理：传入要求平均值的数值列名。",
          ].join(" "),
        );
      }
      return { avg: sm.avg(sessionId, column) };
    }
    case "group_by": {
      if (!column) {
        throw new Error(
          [
            "analyze_memory 参数错误 [ANALYZE_MEMORY_COLUMN_REQUIRED_GROUP_BY]：op=group_by 时必须提供 column。",
            "处理：传入用于分组的列名（类别/维度字段）。",
          ].join(" "),
        );
      }
      return { groups: sm.groupByCount(sessionId, column) };
    }
  }
}
