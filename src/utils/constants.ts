/**
 * System / internal schemas hidden from datasource listing by default.
 */
export const SYSTEM_DBS = [
  "mysql",
  "information_schema",
  "performance_schema",
  "sys",
] as const;

/** Case-insensitive substring matches against table names (deny listing). */
export const TABLE_NAME_DENYLIST_KEYWORDS = [
  "password",
  "secret",
  "salary",
  "user",
  "config",
] as const;

/** Column names containing these substrings are reported as type HIDDEN. */
export const COLUMN_DENYLIST_KEYWORDS = [
  "password",
  "passwd",
  "secret",
  "token",
  "ssn",
  "credit_card",
] as const;

/**
 * MySQL error codes treated as safe to forward to clients (syntax, unknown column/table, etc.).
 * @see https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
 */
export const BUSINESS_ERROR_CODES = new Set<number>([
  1049, // ER_BAD_DB_ERROR
  1054, // ER_BAD_FIELD_ERROR
  1064, // ER_PARSE_ERROR
  1146, // ER_NO_SUCH_TABLE
  1062, // ER_DUP_ENTRY (read-only still useful for uniqueness context)
]);
