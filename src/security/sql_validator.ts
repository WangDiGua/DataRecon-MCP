/**
 * Fast string-level pre-checks before AST parse (defense in depth).
 */

/** Capturing group so we can report which keyword matched. */
const FORBIDDEN_KEYWORD_RE = new RegExp(
  String.raw`\b(DELETE|UPDATE|DROP|ALTER|INSERT|TRUNCATE|GRANT|REVOKE|CREATE|REPLACE|CALL|DO|LOAD|OUTFILE|INFILE|HANDLER)\b`,
  "i",
);

const FORBIDDEN_KEYWORD_LIST =
  "DELETE, UPDATE, DROP, ALTER, INSERT, TRUNCATE, GRANT, REVOKE, CREATE, REPLACE, CALL, DO, LOAD, OUTFILE, INFILE, HANDLER";

/** Block inline comments (can hide keywords). */
const COMMENT = /(--)|(\/\*)/;

/** Block UNION chains (covered again in AST). */
const UNION = /\bUNION\b/i;

export function runSqlPreflight(sql: string): void {
  const s = sql.trim();
  if (!s) {
    throw new Error(
      [
        "SQL 预检失败 [EMPTY_SQL]：传入的 sql 为空或仅含空白。",
        "说明：execute_query 需要非空的 SELECT 语句主体（不要只传 limit/offset）。",
      ].join(" "),
    );
  }

  const kwMatch = s.match(FORBIDDEN_KEYWORD_RE);
  if (kwMatch) {
    const hit = kwMatch[1] ?? kwMatch[0];
    throw new Error(
      [
        `SQL 预检失败 [FORBIDDEN_KEYWORD]：在查询文本中匹配到禁用关键字「${hit}」（不区分大小写）。`,
        "原因：本服务仅允许只读 SELECT；禁止可能改写数据/结构、提权或读写服务器文件的关键字。",
        `完整禁用列表：${FORBIDDEN_KEYWORD_LIST}。`,
        "处理：改为纯 SELECT；若你并未手写该词，请检查是否在注释、拼接字符串或罕见标识符中触发了整词匹配。",
      ].join(" "),
    );
  }

  if (UNION.test(s)) {
    throw new Error(
      [
        "SQL 预检失败 [UNION_NOT_ALLOWED]：不允许使用 UNION（含 UNION ALL）。",
        "原因：避免多段结果集拼接并降低绕过行数/分页限制的风险；UNION 也会在后续 AST 校验中拒绝。",
        "处理：拆成多次 execute_query；或改用 JOIN / 单条 SELECT 子查询表达需求。",
      ].join(" "),
    );
  }

  if (COMMENT.test(s)) {
    throw new Error(
      [
        "SQL 预检失败 [SQL_COMMENTS_NOT_ALLOWED]：不允许在 SQL 中使用注释（`--` 与 `/* */`）。",
        "原因：注释可能用来隐藏真实关键字，削弱字符串级预检。",
        "处理：删除 SQL 内注释后重试；说明性文字请写在对话里，而不是 sql 参数中。",
      ].join(" "),
    );
  }
}
