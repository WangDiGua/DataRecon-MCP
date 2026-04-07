/**
 * Requires Docker: `docker compose up -d mysql` then:
 * PowerShell: `$env:INTEGRATION_MYSQL='1'; $env:MYSQL_HOST='127.0.0.1'; $env:MYSQL_PORT='3307'; $env:MYSQL_USER='readonly'; $env:MYSQL_PASSWORD='readonly'; npm run test -- src/integration`
 */
import { describe, it, expect, beforeAll } from "vitest";

const run = process.env.INTEGRATION_MYSQL === "1";

describe.skipIf(!run)("MySQL execute_query integration", () => {
  beforeAll(() => {
    if (!process.env.MYSQL_HOST) {
      process.env.MYSQL_HOST = "127.0.0.1";
    }
    if (!process.env.MYSQL_PORT) {
      process.env.MYSQL_PORT = "3307";
    }
    if (!process.env.MYSQL_USER) {
      process.env.MYSQL_USER = "readonly";
    }
    if (!process.env.MYSQL_PASSWORD) {
      process.env.MYSQL_PASSWORD = "readonly";
    }
    process.env.MYSQL_DATABASE ??= "";
  });

  it("SELECT returns rows from testdb.items", async () => {
    const { runExecuteQuery } = await import("../tools/execute_query.js");
    const { loadConfig } = await import("../config/index.js");
    const cfg = loadConfig();
    const r = await runExecuteQuery(
      "testdb",
      "SELECT id, amount FROM items ORDER BY id",
      10,
      0,
      {
        MAX_EXPLAIN_ROWS: cfg.MAX_EXPLAIN_ROWS,
        MAX_EXECUTION_TIME: cfg.MAX_EXECUTION_TIME,
      },
    );
    expect(r.rows.length).toBeGreaterThanOrEqual(2);
    expect(r.pagination.returned).toBeGreaterThanOrEqual(2);
  });

  it("rejects DELETE in preflight", async () => {
    const { runExecuteQuery } = await import("../tools/execute_query.js");
    const { loadConfig } = await import("../config/index.js");
    const cfg = loadConfig();
    await expect(
      runExecuteQuery("testdb", "DELETE FROM items", 10, 0, {
        MAX_EXPLAIN_ROWS: cfg.MAX_EXPLAIN_ROWS,
        MAX_EXECUTION_TIME: cfg.MAX_EXECUTION_TIME,
      }),
    ).rejects.toThrow();
  });
});
