/**
 * Fast string-level pre-checks before AST parse (defense in depth).
 */

const FORBIDDEN_KEYWORD = new RegExp(
  String.raw`\b(DELETE|UPDATE|DROP|ALTER|INSERT|TRUNCATE|GRANT|REVOKE|CREATE|REPLACE|CALL|DO|LOAD|OUTFILE|INFILE|HANDLER)\b`,
  "i",
);

/** Block inline comments (can hide keywords). */
const COMMENT = /(--)|(\/\*)/;

/** Block UNION chains (covered again in AST). */
const UNION = /\bUNION\b/i;

export function runSqlPreflight(sql: string): void {
  const s = sql.trim();
  if (!s) {
    throw new Error("Empty SQL");
  }
  if (FORBIDDEN_KEYWORD.test(s)) {
    throw new Error("Forbidden SQL keyword in query");
  }
  if (UNION.test(s)) {
    throw new Error("UNION is not allowed");
  }
  if (COMMENT.test(s)) {
    throw new Error("SQL comments are not allowed");
  }
}
