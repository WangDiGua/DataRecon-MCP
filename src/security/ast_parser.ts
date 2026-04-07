import { Parser } from "node-sql-parser";
import type { Select } from "node-sql-parser";

const parser = new Parser();
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
    throw new Error("Empty SQL");
  }

  let astRoot: unknown;
  try {
    astRoot = parser.parse(trimmed, parseOpt).ast;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`SQL parse error: ${msg}`);
  }

  const statements = Array.isArray(astRoot) ? astRoot : [astRoot];
  if (statements.length !== 1) {
    throw new Error("Only one SQL statement is allowed");
  }

  const stmt = statements[0] as { type?: string };
  if (stmt.type !== "select") {
    throw new Error("Only SELECT statements are allowed");
  }

  const sel = stmt as Select;

  if (sel._next || sel.set_op) {
    throw new Error("UNION and compound SELECT are not allowed");
  }

  if (sel.limit || sel._limit) {
    throw new Error("Remove LIMIT/OFFSET from SQL; use tool parameters.");
  }

  const joins = countJoins(sel);
  if (joins > maxJoins) {
    throw new Error(`At most ${maxJoins} JOINs are allowed`);
  }

  const depth = maxSubqueryDepth(sel);
  if (depth > maxDepth) {
    throw new Error(`Subquery nesting exceeds ${maxDepth}`);
  }

  return trimmed;
}
