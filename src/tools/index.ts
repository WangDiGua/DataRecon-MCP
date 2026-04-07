import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../config/index.js";
import { mysqlIdentifierSchema } from "./schemas.js";
import { toToolJson } from "./json.js";
import { runListDatasources } from "./list_datasources.js";
import { runGetTableList } from "./get_table_list.js";
import { runGetTableSchema } from "./get_table_schema.js";
import { runExecuteQuery } from "./execute_query.js";
import { runStoreToMemory } from "./store_to_memory.js";
import { runAnalyzeMemory } from "./analyze_memory.js";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "list_datasources",
    {
      description:
        "List MySQL database names visible to the configured user (system schemas and DATASOURCE_DENYLIST excluded).",
    },
    async () => {
      const { databases } = await runListDatasources();
      return { content: [{ type: "text", text: toToolJson({ databases }) }] };
    },
  );

  server.registerTool(
    "get_table_list",
    {
      description:
        "List base tables in a schema from information_schema (sensitive name patterns filtered).",
      inputSchema: {
        db_name: mysqlIdentifierSchema.describe("Database/schema name"),
      },
    },
    async ({ db_name }) => {
      const { tables } = await runGetTableList(db_name);
      return { content: [{ type: "text", text: toToolJson({ tables }) }] };
    },
  );

  server.registerTool(
    "get_table_schema",
    {
      description:
        "Column and index metadata for one table (sensitive column types shown as HIDDEN).",
      inputSchema: {
        db_name: mysqlIdentifierSchema,
        table_name: mysqlIdentifierSchema,
      },
    },
    async ({ db_name, table_name }) => {
      const schema = await runGetTableSchema(db_name, table_name);
      return { content: [{ type: "text", text: toToolJson(schema) }] };
    },
  );

  server.registerTool(
    "execute_query",
    {
      description:
        "Run a read-only SELECT: regex + AST checks, EXPLAIN row ceiling, MAX_EXECUTION_TIME hint, enforced LIMIT/OFFSET (no LIMIT in SQL).",
      inputSchema: {
        db_name: mysqlIdentifierSchema,
        sql: z.string().min(1).describe("SQL SELECT body."),
        limit: z.coerce.number().int().min(1).optional().describe("Max rows (capped by MAX_QUERY_ROWS)."),
        offset: z.coerce.number().int().min(0).optional(),
      },
    },
    async ({ db_name, sql, limit, offset }) => {
      const cfg = loadConfig();
      const lim = Math.min(limit ?? cfg.MAX_QUERY_ROWS, cfg.MAX_QUERY_ROWS);
      const off = offset ?? 0;
      const result = await runExecuteQuery(db_name, sql, lim, off, {
        MAX_EXPLAIN_ROWS: cfg.MAX_EXPLAIN_ROWS,
        MAX_EXECUTION_TIME: cfg.MAX_EXECUTION_TIME,
      });
      return {
        content: [{ type: "text", text: toToolJson(result) }],
      };
    },
  );

  server.registerTool(
    "store_to_memory",
    {
      description:
        "Store a JSON array of row objects in an in-memory session (quotas from MAX_SESSION_ROWS / MAX_SESSION_BYTES).",
      inputSchema: {
        session_id: z
          .string()
          .min(1)
          .optional()
          .describe("Reuse an existing session id or omit to create one."),
        rows: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .describe("Result rows, same shape as execute_query rows."),
      },
    },
    async ({ session_id, rows }) => {
      const out = runStoreToMemory(session_id, rows);
      return { content: [{ type: "text", text: toToolJson(out) }] };
    },
  );

  server.registerTool(
    "analyze_memory",
    {
      description:
        "Aggregate data previously stored with store_to_memory (count, sum, avg, group_by).",
      inputSchema: {
        session_id: z.string().min(1),
        op: z.enum(["count", "sum", "avg", "group_by"]),
        column: z.string().min(1).optional().describe("Column name for sum, avg, or group_by."),
      },
    },
    async ({ session_id, op, column }) => {
      const out = runAnalyzeMemory(session_id, op, column);
      return { content: [{ type: "text", text: toToolJson(out) }] };
    },
  );
}
