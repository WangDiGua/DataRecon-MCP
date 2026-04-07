import { BUSINESS_ERROR_CODES } from "../utils/constants.js";

/** Errors that must never leak raw details (connection, privileges, server identity). */
const SENSITIVE_ERRNO = new Set<number>([
  1044, // ER_DBACCESS_DENIED_ERROR
  1045, // ER_ACCESS_DENIED_ERROR
  2002, // CR_CONNECTION_ERROR
  2003, // CR_CONN_HOST_ERROR
  2013, // CR_SERVER_LOST
]);

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;

type MysqlLikeError = Error & {
  code?: string;
  errno?: number;
  sqlMessage?: string;
};

function asMysqlError(err: unknown): MysqlLikeError | null {
  if (!(err instanceof Error)) {
    return null;
  }
  return err as MysqlLikeError;
}

function redactMessage(msg: string): string {
  return msg.replace(IPV4, "[redacted]").replace(/\(Ver [^)]+\)/gi, "(Ver [redacted])");
}

/**
 * Maps MySQL/driver errors to client-safe messages. Business errors pass through sqlMessage.
 */
export function filterMysqlError(err: unknown): Error {
  const e = asMysqlError(err);
  if (!e) {
    return new Error("Query failed");
  }

  const errno = typeof e.errno === "number" ? e.errno : undefined;
  const msg = e.sqlMessage ?? e.message;

  if (errno !== undefined && BUSINESS_ERROR_CODES.has(errno)) {
    return new Error(msg);
  }

  if (errno !== undefined && SENSITIVE_ERRNO.has(errno)) {
    return new Error("Database connection or permission error");
  }

  if (e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT" || e.code === "ENOTFOUND") {
    return new Error("Database connection error");
  }

  return new Error(redactMessage(msg) || "Query failed");
}
