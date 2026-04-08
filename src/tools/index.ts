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
  const queryRowCap = loadConfig().MAX_QUERY_ROWS;
  server.registerTool(
    "list_datasources",
    {
      description:
        "列出当前配置账号可见的 MySQL 数据库名（已排除系统库以及 DATASOURCE_DENYLIST 中的库）。",
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
        "根据 information_schema 列出指定库中的基表（已按敏感名称规则过滤）。",
      inputSchema: {
        db_name: mysqlIdentifierSchema.describe("数据库名（schema）"),
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
        "查询单张表的列与索引元数据（敏感列类型显示为 HIDDEN）。",
      inputSchema: {
        db_name: mysqlIdentifierSchema.describe("数据库名（schema）"),
        table_name: mysqlIdentifierSchema.describe("表名"),
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
      description: [
        "执行只读 SELECT（正则 + AST + EXPLAIN 等安全链；不要在 SQL 里写 LIMIT/OFFSET）。",
        "分页用工具参数 limit、offset，不要用 SQL LIMIT。",
        `省略 limit 时默认最多 ${queryRowCap} 行（由 .env 的 MAX_QUERY_ROWS 决定，可上调）。`,
        "若结果总是只有 10 行，通常是调用方显式传了 limit=10；需要更多请传更大 limit 或省略 limit。",
        "示例：第一页 limit=100&offset=0；第二页 limit=100&offset=100。",
        "响应里的 pagination 与 pagination_hint 含当前页信息及是否有下一页提示。",
      ].join(" "),
      inputSchema: {
        db_name: mysqlIdentifierSchema.describe("数据库名（schema）"),
        sql: z.string().min(1).describe("SELECT 语句主体。"),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            `本页最多返回行数（工具参数，勿写在 SQL）。省略时默认 ${queryRowCap}（.env 中 MAX_QUERY_ROWS）。传入值大于上限时会被截断为该上限。`,
          ),
        offset: z.coerce
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "跳过行数（分页）：第一页 0；下一页使用响应里 pagination_hint.next_offset。",
          ),
      },
    },
    async ({ db_name, sql, limit, offset }) => {
      const cfg = loadConfig();
      const limCap = cfg.MAX_QUERY_ROWS;
      const lim = Math.min(limit ?? limCap, limCap);
      const off = offset === undefined || offset === null ? 0 : offset;
      const result = await runExecuteQuery(db_name, sql, lim, off, {
        MAX_EXPLAIN_ROWS: cfg.MAX_EXPLAIN_ROWS,
        MAX_EXECUTION_TIME: cfg.MAX_EXECUTION_TIME,
      });
      const { pagination } = result;
      const mayHaveMore =
        pagination.limit > 0 &&
        pagination.returned === pagination.limit;
      const payload = {
        ...result,
        pagination_hint: mayHaveMore
          ? {
              may_have_more: true,
              next_offset: pagination.offset + pagination.limit,
              reuse_limit: pagination.limit,
            }
          : {
              may_have_more: false,
            },
      };
      return {
        content: [{ type: "text", text: toToolJson(payload) }],
      };
    },
  );

  server.registerTool(
    "store_to_memory",
    {
      description:
        "将查询结果行以 JSON 数组形式存入进程内会话内存（配额由 MAX_SESSION_ROWS / MAX_SESSION_BYTES 限制）。",
      inputSchema: {
        session_id: z
          .string()
          .min(1)
          .optional()
          .describe("复用已有会话 ID；省略则创建新会话。"),
        rows: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .describe("行对象数组，字段形状与 execute_query 返回的 rows 一致。"),
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
        "对 store_to_memory 暂存的数据做聚合（count、sum、avg、group_by）。",
      inputSchema: {
        session_id: z.string().min(1).describe("会话 ID。"),
        op: z
          .enum(["count", "sum", "avg", "group_by"])
          .describe("聚合操作：count / sum / avg / group_by。"),
        column: z
          .string()
          .min(1)
          .optional()
          .describe("用于 sum、avg 或 group_by 的列名。"),
      },
    },
    async ({ session_id, op, column }) => {
      const out = runAnalyzeMemory(session_id, op, column);
      return { content: [{ type: "text", text: toToolJson(out) }] };
    },
  );
}
