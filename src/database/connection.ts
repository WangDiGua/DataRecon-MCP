import { createPool, type Pool } from "mysql2/promise";
import { loadConfig, type AppConfig } from "../config/index.js";

/**
 * MySQL access for this MCP server.
 *
 * **Deployment:** Grant the configured DB user **read-only** privileges (SELECT only on required
 * schemas/tables). This service must not mutate production data.
 */
let pool: Pool | undefined;

export function createPoolFromConfig(config: AppConfig): Pool {
  return createPool({
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    database: config.MYSQL_DATABASE || "",
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: false,
    enableKeepAlive: true,
  });
}

/**
 * Returns the shared pool, creating it from `loadConfig()` on first use unless a config override
 * is supplied (useful in tests).
 */
export function getPool(config?: AppConfig): Pool {
  if (!pool) {
    pool = createPoolFromConfig(config ?? loadConfig());
  }
  return pool;
}

/** Reset or inject the pool (unit tests only). */
export function setPoolForTests(p: Pool | undefined): void {
  pool = p;
}

export async function healthCheck(): Promise<boolean> {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
