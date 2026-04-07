# DataRecon-MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Node.js (TypeScript) MCP server that exposes read-only MySQL inspection tools with mandatory pagination, raw business error passthrough, in-memory session buffers, layered security, and three transports (Stdio / HTTP-SSE / WebSocket).

**Architecture:** Centralize MCP tool registration and dispatch in `server.ts`; isolate MySQL access behind a single pool module; run all SQL through AST + regex + EXPLAIN gates before execution; keep session aggregates in `SessionManager` with LRU eviction; select transport via config factory; route HTTP/WS behind JWT or API key and rate limits.

**Tech Stack:** TypeScript (ES2020, strict), `@modelcontextprotocol/sdk`, `mysql2`, `zod`, `dotenv`, `node-sql-parser`, `lru-cache`, `express`, `cors`, `ws`, `express-rate-limit`, `jsonwebtoken`, `vitest` (tests), `tsx` or `ts-node` (dev runs).

---

## 文件与职责（落地映射）

与 `.trae/documents/DataRecon-MCP开发计划.md` 对齐的目录约定：

| 路径 | 职责 |
|------|------|
| `src/index.ts` | 读取配置 → `createTransport()` → 启动 |
| `src/server.ts` | `McpServer` 实例、工具注册、`callTool` 分发 |
| `src/config/index.ts` | `zod` 校验环境变量、导出只读配置对象 |
| `src/transport/index.ts` | `Transport` 接口 + 工厂 |
| `src/transport/stdio.ts` | `StdioServerTransport` |
| `src/transport/http-sse.ts` | Express + SSE MCP 端点、CORS、限流、健康检查 |
| `src/transport/websocket.ts` | `ws` 服务器、心跳、握手认证 |
| `src/database/connection.ts` | 从配置创建 `mysql2` 连接池 |
| `src/database/pool.ts` | 健康检查、空闲回收封装（如与 connection 合并则删除冗余文件） |
| `src/memory/session_manager.ts` | 会话 Map、行/字节配额、LRU、聚合 |
| `src/tools/*.ts` | 六个 MCP 工具实现 |
| `src/security/*.ts` | AST、校验、EXPLAIN、错误过滤、认证 |
| `src/utils/logger.ts` | stderr 日志、查询审计、trace id |
| `src/utils/constants.ts` | 黑名单、关键词、白名单错误码 |

---

## Phase 0：工程脚手架

### Task 0：初始化 npm + TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`
- Create: `vitest.config.ts`

- [ ] **Step 1：** 在仓库根目录执行 `npm init -y`，安装依赖  
  `npm install @modelcontextprotocol/sdk mysql2 zod dotenv node-sql-parser lru-cache express cors ws express-rate-limit jsonwebtoken`  
  `npm install -D typescript @types/node @types/express @types/ws @types/jsonwebtoken vitest`

- [ ] **Step 2：** `tsconfig.json`：`target` ES2020、`strict` true、`outDir` `dist`、`rootDir` `src`、`module` NodeNext 或 CommonJS（与 `"type"` 字段一致）。

- [ ] **Step 3：** `package.json` 增加脚本：  
  `"build": "tsc"`，`"start": "node dist/index.js"`，`"test": "vitest run"`，`"test:watch": "vitest"`。

- [ ] **Step 4：** 将 `.trae/documents/DataRecon-MCP开发计划.md` 「六、环境变量」整段同步到 `.env.example`（与原文一致）。

- [ ] **Step 5：** 提交 `chore: scaffold DataRecon-MCP ts project`。

---

### Task 1：配置模块

**Files:**
- Create: `src/config/index.ts`
- Test: `src/config/index.test.ts`

- [ ] **Step 1：失败测试** — 在 `src/config/index.test.ts` 中断言：缺少 `MYSQL_HOST` 时 `loadConfig()` 抛出 `ZodError`（或你封装的校验错误）。

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('loadConfig', () => {
  it('throws when MYSQL_HOST is missing', async () => {
    vi.stubEnv('MYSQL_HOST', '');
    const { loadConfig } = await import('./index');
    expect(() => loadConfig()).toThrow();
  });
});
```

- [ ] **Step 2：** 运行 `npm run test -- src/config/index.test.ts` — **预期 FAIL**（模块不存在）。

- [ ] **Step 3：最小实现** — `loadConfig()` 使用 `z.object` 定义：`MYSQL_*`、`MAX_*`、`TRANSPORT_TYPE`（enum）、HTTP/WS 端口、`AUTH_TYPE`、`JWT_SECRET`、`API_KEY`、rate limit 字段；默认与文档一致；使用 `dotenv/config` 或在 `index.ts` 顶层 `config()`。

- [ ] **Step 4：** 再次运行测试 — **预期 PASS**。

- [ ] **Step 5：** `git commit -m "feat(config): zod-validated env loading"`。

---

### Task 2：日志（stderr）

**Files:**
- Create: `src/utils/logger.ts`
- Test: `src/utils/logger.test.ts`（可选：spy `process.stderr.write`）

- [ ] **Step 1：** 实现 `logInfo` / `logError` / `auditQuery`，**只写 stderr**；导出 `initLogger()` 将 `console.log`/`console.info` 重定向到 logger（避免破坏 MCP stdio）。

- [ ] **Step 2：** 在 `src/index.ts` 顶部最先调用 `initLogger()`（Task 3 创建 `index.ts` 时接入）。

- [ ] **Step 3：** `git commit -m "feat(logger): stderr-only structured logging"`。

---

## Phase 1：数据库层 + MCP 空壳

### Task 3：MySQL 连接池

**Files:**
- Create: `src/database/connection.ts`（可合并 `pool.ts` 逻辑）
- Test: `src/database/connection.test.ts` — 使用 `mysql2` mock 或 testcontainers（首版可 mock `createPool`）

- [ ] **Step 1：** 从配置创建 `mysql2/promise` pool：`multipleStatements: false`，用户为只读账号（由部署保证，代码注释说明）。

- [ ] **Step 2：** 暴露 `getPool()`、`healthCheck(): Promise<boolean>`（`SELECT 1`）。

- [ ] **Step 3：** `git commit -m "feat(db): mysql2 pool with health check"`。

---

### Task 4：MCP Server 骨架 + Stdio**

**Files:**
- Create: `src/server.ts`, `src/index.ts`, `src/tools/index.ts`（空 `registerTools`）
- Create: `src/transport/index.ts`, `src/transport/stdio.ts`

- [ ] **Step 1：** `server.ts` 中 `new McpServer({ name: 'datarecon', version: '0.1.0' })`，注册占位 `list_datasources`（返回 `{ content: [{ type: 'text', text: 'ok' }] }`）以验证链路。

- [ ] **Step 2：** `transport/stdio.ts` 使用 SDK 的 `StdioServerTransport` 连接 `server.server`（以 `@modelcontextprotocol/sdk` 实际 API 为准）。

- [ ] **Step 3：** `npm run build && TRANSPORT_TYPE=stdio node dist/index.js`，用 MCP Inspector 或 Claude Desktop 验证能枚举工具。

- [ ] **Step 4：** `git commit -m "feat(mcp): stdio transport and server skeleton"`。

---

## Phase 2：传输与认证

### Task 5：HTTP-SSE 传输

**Files:**
- Create: `src/transport/http-sse.ts`
- Modify: `src/security/auth.ts`（JWT / API key 占位接口）

- [ ] **Step 1：** Express 挂载 MCP Streamable HTTP 或 SSE 端点（按 SDK 当前推荐方式实现；若 SDK 仅提供 stdio，则使用官方 HTTP 传输示例项目对齐）。

- [ ] **Step 2：** `cors` 读取 `CORS_ORIGIN`；`express-rate-limit` 使用环境变量；`GET /health` 返回 200。

- [ ] **Step 3：** 集成测试：`supertest` 可选；或 `curl` 手册步骤写入本任务备注 — **验收**：`TRANSPORT_TYPE=http-sse` 启动后 health 与单次 `tools/list` 可用。

- [ ] **Step 4：** `git commit -m "feat(transport): http-sse with cors and rate limit"`。

---

### Task 6：WebSocket 传输

**Files:**
- Create: `src/transport/websocket.ts`

- [ ] **Step 1：** `ws` Server，路径 `/mcp`；消息 JSON 编解码；ping/pong 心跳。

- [ ] **Step 2：** 连接建立时校验 `AUTH_TYPE`（query header 或首条 auth 消息）。

- [ ] **Step 3：** `git commit -m "feat(transport): websocket with heartbeat"`。

---

### Task 7：认证实现

**Files:**
- Modify: `src/security/auth.ts`
- Test: `src/security/auth.test.ts`

- [ ] **Step 1：** 实现 `verifyJwt(authHeader)`、`verifyApiKey(header 或 query)`；`AUTH_TYPE=none` 时短路通过。

- [ ] **Step 2：** 单元测试：有效/无效 token、missing key。

- [ ] **Step 3：** `git commit -m "feat(auth): jwt and api key for http/ws"`。

---

## Phase 3：探测工具

### Task 8：`src/utils/constants.ts`

- [ ] **Step 1：** 导出 `SYSTEM_DBS`、`TABLE_NAME_DENYLIST` 关键词、`COLUMN_DENYLIST` 关键词、`BUSINESS_ERROR_CODES` 白名单（与 MySQL 错误号文档对齐后固化）。

- [ ] **Step 2：** `git commit -m "feat(constants): security lists"`。

---

### Task 9：`list_datasources`

**Files:**
- Create: `src/tools/list_datasources.ts`
- Register in: `src/tools/index.ts`, `src/server.ts`

- [ ] **Step 1：** 执行 `SHOW DATABASES`，过滤系统库 + 可扩展动态黑名单（环境变量 `DATASOURCE_DENYLIST` 可选）。

- [ ] **Step 2：** 集成测试需测试 DB 或 snapshot mock。

- [ ] **Step 3：** `git commit -m "feat(tools): list_datasources"`。

---

### Task 10：`get_table_list`

**Files:**
- Create: `src/tools/get_table_list.ts`

- [ ] **Step 1：** 参数 `db_name` zod 校验；查询 `information_schema.TABLES`，过滤敏感表名模式。

- [ ] **Step 2：** 返回 `TABLE_NAME`、`TABLE_COMMENT`。

- [ ] **Step 3：** `git commit -m "feat(tools): get_table_list"`。

---

### Task 11：`get_table_schema`

**Files:**
- Create: `src/tools/get_table_schema.ts`

- [ ] **Step 1：** `information_schema.COLUMNS` + `STATISTICS`；敏感列名替换类型描述为 `HIDDEN` 或掩码。

- [ ] **Step 2：** `git commit -m "feat(tools): get_table_schema"`。

---

### Task 12：`execute_query`（基础版，尚无安全链）

**Files:**
- Create: `src/tools/execute_query.ts`

- [ ] **Step 1：** 参数：`db_name`, `sql`, `limit`, `offset`；暂时直接包装 `LIMIT`/`OFFSET`（后续 Task 16 替换为 AST 重写）。

- [ ] **Step 2：** 返回 `{ rows, pagination: { limit, offset, returned } }`。

- [ ] **Step 3：** `git commit -m "feat(tools): execute_query basic"`。

---

## Phase 4：安全纵深

### Task 13：AST 解析器

**Files:**
- Create: `src/security/ast_parser.ts`
- Test: `src/security/ast_parser.test.ts`

- [ ] **Step 1：失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { assertSelectOnly } from './ast_parser';

describe('assertSelectOnly', () => {
  it('rejects DELETE', () => {
    expect(() => assertSelectOnly('DELETE FROM t')).toThrow(/SELECT/i);
  });
});
```

- [ ] **Step 2：** 实现：仅允许单条 SELECT；禁止多语句；JOIN 深度 ≤ 3；无 LIMIT 时插入 LIMIT（常量 `MAX_QUERY_ROWS`）。

- [ ] **Step 3：** `npm run test -- src/security/ast_parser.test.ts` — PASS。

- [ ] **Step 4：** `git commit -m "feat(security): sql ast select-only and limit rewrite"`。

---

### Task 14：`sql_validator.ts`

**Files:**
- Create: `src/security/sql_validator.ts`
- Test: `src/security/sql_validator.test.ts`

- [ ] **Step 1：** 正则拦截 `DELETE|UPDATE|DROP|ALTER|INSERT|TRUNCATE` 等；检测注释符、`UNION` 滥用、子查询嵌套深度。

- [ ] **Step 2：** `git commit -m "feat(security): regex sql pre-validator"`。

---

### Task 15：`explain_check.ts`

**Files:**
- Create: `src/security/explain_check.ts`
- Test: `src/security/explain_check.test.ts`（mock pool.query）

- [ ] **Step 1：** `EXPLAIN <query>`，解析 `rows` 估算，超过 `MAX_EXPLAIN_ROWS` 拒绝。

- [ ] **Step 2：** `git commit -m "feat(security): explain row estimate gate"`。

---

### Task 16：`error_filter.ts`

**Files:**
- Create: `src/security/error_filter.ts`
- Test: `src/security/error_filter.test.ts`

- [ ] **Step 1：** 分类：未知列、语法错误等业务错误 — **原样 message**；连接失败、ER_ACCESS_DENIED 等 — **泛化文案**，去除 IP、版本片段。

- [ ] **Step 2：** `git commit -m "feat(security): error message filter"`。

---

### Task 17：SQL 预处理 + `execute_query` 集成

**Files:**
- Modify: `src/tools/execute_query.ts`
- Create: `src/security/sql_preprocess.ts`（或并入 `execute_query`）

- [ ] **Step 1：** 顺序：`sql_validator` → `assertSelectOnly` → `explain_check` → 注入 `MAX_EXECUTION_TIME` 提示（`/*+ MAX_EXECUTION_TIME(...) */` 或会话级 `SET` 择一，与 MySQL 版本兼容策略写清）。

- [ ] **Step 2：** 执行查询；错误走 `error_filter`。

- [ ] **Step 3：** `git commit -m "feat(execute_query): full security pipeline"`。

---

## Phase 5：内存会话

### Task 18：`SessionManager`

**Files:**
- Create: `src/memory/session_manager.ts`
- Test: `src/memory/session_manager.test.ts`

- [ ] **Step 1：** `store(sessionId, rows)` 检查行数与字节和（JSON序列化估算）；超限 LRU 驱逐最旧 session。

- [ ] **Step 2：** `aggregate(ops)`：`sum`/`avg`/`count`/`group_by` 在内存执行。

- [ ] **Step 3：** `git commit -m "feat(memory): session manager with quotas"`。

---

### Task 19：`store_to_memory` / `analyze_memory`

**Files:**
- Create: `src/tools/store_to_memory.ts`, `src/tools/analyze_memory.ts`

- [ ] **Step 1：** `store_to_memory` 接受查询结果引用或子查询参数（与文档一致：可先只接受已有 result set id）。

- [ ] **Step 2：** `analyze_memory` 调用 `SessionManager.aggregate`。

- [ ] **Step 3：** `git commit -m "feat(tools): memory store and analyze"`。

---

## Phase 6：测试、文档、部署

### Task 20：单元与集成测试收尾

- [ ] **Step 1：** 补齐 security、memory、auth 覆盖率目标（建议 ≥80% on security）。

- [ ] **Step 2：** 集成测试：`docker compose` 启动 `mysql:8`，只读用户，跑 `execute_query`  happy path + 拒绝写操作案例。

- [ ] **Step 3：** `git commit -m "test: integration suite with mysql"`。

---

### Task 21：部署资产

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`
- Create: `docs/claude-desktop-config.json.example`（或仓库根示例）

- [ ] **Step 1：** 多阶段构建：`npm ci`、`npm run build`、`node dist/index.js`，默认 `TRANSPORT_TYPE=http-sse`，文档说明覆盖为 stdio。

- [ ] **Step 2：** `docker-compose`：app + mysql（开发用），生产拆分。

- [ ] **Step 3：** `git commit -m "chore: docker and compose examples"`。

---

## 规格自检（对照原开发计划）

| 原文章节 | 本计划 Task |
|---------|-------------|
| 一、项目初始化 | Task 0–1 |
| 二、传输层 | Task 4–6 |
| 三、核心模块（server/db/memory） | Task 2–4, 18 |
| 四、工具集 | Task 8–12, 19 |
| 五、安全防护 | Task 13–17, 7 |
| 六、配置与常量 | Task 0–1, 8 |
| 七、日志 | Task 2 |
| 八、测试与部署 | Task 20–21 |

**已知缺口（需在实现时对齐 SDK）：** MCP 的 HTTP/SSE 具体 API 以 `@modelcontextprotocol/sdk` 当前版本为准；若官方示例与本文假设不同，在 Task 5 首步查阅 SDK 并调整端点实现，不改变安全与工具语义。

---

## Self-Review

1. **Spec coverage：** 原文六工具、三传输、认证、限流、EXPLAIN、AST、错误过滤、内存配额、日志、部署均已映射到 Task。
2. **Placeholders：** 无 “TBD”；具体测试代码已给出 config/ast 样例。
3. **Type consistency：** `loadConfig` / `assertSelectOnly` / 工具参数均以 `zod` + TS 类型在各自模块导出，后续任务应 `import type` 对齐。

---

## 执行方式（任选）

**Plan complete and saved to `docs/superpowers/plans/2026-04-07-datarecon-mcp-implementation.md`.**

1. **Subagent-Driven（推荐）** — 每个 Task 单独子代理执行，任务间隙人工 Review。  
2. **Inline Execution** — 本会话按 Task 顺序实现，设里程碑检查点。

你更希望采用哪一种？
