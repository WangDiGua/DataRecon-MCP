import type { Select } from "node-sql-parser";
import pkg from "node-sql-parser";
import type { Parser as SqlParserInstance } from "node-sql-parser";

const { Parser: SqlParser } = pkg as { Parser: new () => SqlParserInstance };
const parser = new SqlParser();
const parseOpt = { database: "MySQL" as const };

function countJoins(sel: Select): number {
  const from = sel.from;
  if (!from || !Array.isArray(from)) {
    return 0;
  }
  return from.filter((part) => part && typeof part === "object" && "join" in part).length;
}

/** Max nesting depth of inner `type: "select"` nodes under a top-level SELECT (not counting root). */
export function maxSubqueryDepth(sel: Select): number {
  return Math.max(
    subqueryDepthFromNode(sel.from),
    subqueryDepthFromNode(sel.columns),
    subqueryDepthFromNode(sel.where),
    subqueryDepthFromNode(sel.having),
    subqueryDepthFromNode(sel.orderby),
    subqueryDepthFromNode(sel.with),
    subqueryDepthFromNode(sel.groupby),
  );
}

function subqueryDepthFromNode(node: unknown): number {
  if (node == null || typeof node !== "object") {
    return 0;
  }
  if (Array.isArray(node)) {
    return Math.max(0, ...node.map(subqueryDepthFromNode));
  }
  const o = node as Record<string, unknown>;
  if (o.type === "select") {
    const inner = Math.max(
      0,
      ...Object.entries(o)
        .filter(([k]) => k !== "loc")
        .map(([, v]) => subqueryDepthFromNode(v)),
    );
    return 1 + inner;
  }
  return Math.max(0, ...Object.values(o).map(subqueryDepthFromNode));
}

/**
 * Parse and enforce: single SELECT, no UNION, no LIMIT/OFFSET in SQL (use tool args),
 * join count ≤ maxJoins, subquery depth ≤ maxSubqueryDepthInner.
 * Returns trimmed SQL without trailing semicolon.
 */
export function assertSelectOnly(
  sql: string,
  options?: { maxJoins?: number; maxSubqueryDepth?: number },
): string {
  const maxJoins = options?.maxJoins ?? 3;
  const maxDepth = options?.maxSubqueryDepth ?? 3;

  const trimmed = sql.trim().replace(/;+\s*$/u, "");
  if (!trimmed) {
    throw new Error(
      [
        "SQL 语法校验失败 [EMPTY_SQL_AFTER_TRIM]：去掉首尾空白与末尾分号后，语句为空。",
        "处理：传入有效的 SELECT 正文。",
      ].join(" "),
    );
  }

  let astRoot: unknown;
  try {
    astRoot = parser.parse(trimmed, parseOpt).ast;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      [
        `SQL 语法校验失败 [PARSE_ERROR]：解析器报错如下 — ${msg}`,
        "常见原因：括号/引号不配、非 MySQL 方言、保留字未加反引号、或语句被截断。",
        `已提交文本（前 200 字符）：${trimmed.slice(0, 200)}${trimmed.length > 200 ? "…" : ""}`,
      ].join(" "),
    );
  }

  const statements = Array.isArray(astRoot) ? astRoot : [astRoot];
  if (statements.length !== 1) {
    throw new Error(
      [
        `SQL 语法校验失败 [SINGLE_STATEMENT_ONLY]：解析得到 ${statements.length} 条语句，仅允许 1 条。`,
        "原因：禁止多语句批量执行（含分号分隔的多条 SQL）。",
        "处理：每次 execute_query 只传一条 SELECT；多条请分多次调用。",
      ].join(" "),
    );
  }

  const stmt = statements[0] as { type?: string };
  if (stmt.type !== "select") {
    const t = stmt.type ?? "unknown";
    throw new Error(
      [
        `SQL 语法校验失败 [ALLOW_SELECT_ONLY]：仅允许 SELECT。当前语句 AST 类型为「${t}」。`,
        "处理：改为单条只读 SELECT；INSERT/UPDATE/DELETE/DDL 等均会被拒绝。",
      ].join(" "),
    );
  }

  const sel = stmt as Select;

  if (sel._next || sel.set_op) {
    throw new Error(
      [
        "SQL 语法校验失败 [NO_UNION_COMPOUND]：不允许 UNION / 复合 SELECT（set_op）。",
        "处理：不要用 UNION；用多次查询或 JOIN/子查询替代。",
      ].join(" "),
    );
  }

  if (sel.limit || sel._limit) {
    throw new Error(
      [
        "SQL 语法校验失败 [NO_LIMIT_IN_SQL]：不要在 SQL 里写 LIMIT 或 OFFSET。",
        "原因：行数与分页由工具参数 limit、offset 统一附加，避免与服务器策略不一致。",
        "处理：删掉 SQL 中的 LIMIT/OFFSET，改用 execute_query 的 limit、offset 参数。",
      ].join(" "),
    );
  }

  const joins = countJoins(sel);
  if (joins > maxJoins) {
    throw new Error(
      [
        `SQL 语法校验失败 [JOIN_LIMIT]：当前 JOIN 数为 ${joins}，允许上限为 ${maxJoins}。`,
        "处理：减少 JOIN 数量、拆查询，或联系管理员调整策略（若项目支持配置 maxJoins）。",
      ].join(" "),
    );
  }

  const depth = maxSubqueryDepth(sel);
  if (depth > maxDepth) {
    throw new Error(
      [
        `SQL 语法校验失败 [SUBQUERY_DEPTH]：子查询嵌套深度为 ${depth}，允许上限为 ${maxDepth}（不含最外层 SELECT）。`,
        "处理：flatten 部分子查询、改用临时中间结果（如 store_to_memory）或拆分多次查询。",
      ].join(" "),
    );
  }

  return trimmed;
}
