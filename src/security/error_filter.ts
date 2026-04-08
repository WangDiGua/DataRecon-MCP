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
    return new Error(
      [
        "数据库查询失败 [MYSQL_ERR_NON_DB_ERROR]：捕获到的异常不是带 errno/sqlMessage 的 MySQL 驱动错误。",
        "处理：重试请求；若反复出现请查看服务端日志中的原始堆栈。",
      ].join(" "),
    );
  }

  const errno = typeof e.errno === "number" ? e.errno : undefined;
  const msg = e.sqlMessage ?? e.message;

  if (errno !== undefined && BUSINESS_ERROR_CODES.has(errno)) {
    return new Error(
      [
        `数据库返回错误 [MYSQL_BUSINESS_ERRNO_${errno}]：${msg}`,
        "说明：属常见语法/对象不存在类错误，按策略保留 MySQL 原文便于你修正 SQL。",
        "处理：根据上文报错检查库名、表名、字段名与 SQL 方言；确认已连到预期库。",
      ].join(" "),
    );
  }

  if (errno !== undefined && SENSITIVE_ERRNO.has(errno)) {
    return new Error(
      [
        `数据库连接或权限失败 [MYSQL_SENSITIVE_ERRNO_${errno}]（connection / permission 类）：详情已隐藏以防泄露主机、账号或路径。`,
        "处理：核对 .env 中 MYSQL_HOST、MYSQL_PORT、MYSQL_USER、MYSQL_PASSWORD；确认账号对目标库至少有 SELECT；检查网络与防火墙。",
      ].join(" "),
    );
  }

  if (e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT" || e.code === "ENOTFOUND") {
    return new Error(
      [
        `数据库网络错误 [MYSQL_NETWORK_${e.code}]：无法与数据库建立连接（拒绝/超时/域名解析失败等）。`,
        "处理：确认库监听地址与端口、本机能否 ping/telnet、云安全组与 VPN；若为远程库勿填错内网地址。",
      ].join(" "),
    );
  }

  const safe = redactMessage(msg);
  return new Error(
    [
      `数据库返回错误 [MYSQL_GENERIC]：${safe || "（驱动未提供可读消息）"}`,
      "说明：未命中“可转发业务错误码”或“固定脱敏连接错误”；已对消息中的 IP 等做了脱敏。",
      "处理：结合片段排查 SQL 与环境；需要完整原因时由管理员查看服务器日志。",
    ].join(" "),
  );
}

/** Runs an async DB operation and maps failures through {@link filterMysqlError} for consistent MCP-facing errors. */
export async function withMysqlErrorFilter<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw filterMysqlError(e);
  }
}
