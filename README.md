# DataRecon-MCP

面向只读 MySQL 巡查的 [Model Context Protocol](https://modelcontextprotocol.io) 服务：提供数据源列举、表结构、受限 `SELECT` 查询，以及可选的会话内存工具。支持 **stdio**、**HTTP SSE（Streamable HTTP）**、**WebSocket** 三种传输方式。

## 功能概要

- 工具：`list_datasources`、`get_table_list`、`get_table_schema`、`execute_query`、`store_to_memory`、`analyze_memory` 等
- 安全链：正则预检、AST（`node-sql-parser`）、EXPLAIN 行数上限、可选 `MAX_EXECUTION_TIME`、错误信息过滤
- 认证：`none` / `apikey` / `jwt`（公网务必不要长期使用 `none`）

## 环境要求

- Node.js 18+（推荐当前 LTS）
- 可访问的 MySQL 5.7+ / 8.x；账号建议仅 `SELECT` 权限

## 快速开始

```bash
git clone https://github.com/WangDiGua/DataRecon-MCP.git
cd DataRecon-MCP
npm ci
npm run build
```

在仓库根目录复制环境模板并填写真实值（**不要将含密码的 `.env` 提交到 Git**）：

```bash
cp .env.production.example .env
# 编辑 .env：MYSQL_*、API_KEY、CORS_ORIGIN 等
```

启动：

```bash
npm start
```

默认端口（可在 `.env` 中修改）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HTTP_PORT` | `3847` | `TRANSPORT_TYPE=http-sse` 时监听端口 |
| `WS_PORT` | `3848` | `TRANSPORT_TYPE=websocket` 时监听端口 |

生产环境模板说明见仓库内 [`.env.production.example`](./.env.production.example)。

## Docker

```bash
docker build -t datarecon-mcp .
# 需自行挂载或传入与 .env 等价的环境变量；映射主机端口到容器内 HTTP_PORT（默认 3847）
```

更完整的编排示例见 [`docker-compose.yml`](./docker-compose.yml)。

## MCP 客户端配置（一键复制）

以下 JSON 可按你的客户端说明合并到对应配置文件中（例如 Claude Desktop 的 `claude_desktop_config.json`、`%APPDATA%\Claude\...`，或 Cursor 的 MCP 设置）。**请替换占位路径、主机名和密钥。**

### 1. 本机 stdio（Claude Desktop / Cursor 等）

适用于在本机直接运行 `node dist/index.js`，由客户端通过标准输入输出连接 MCP。

```json
{
  "mcpServers": {
    "datarecon": {
      "command": "node",
      "args": [
        "C:/absolute/path/to/DataRecon-MCP/dist/index.js"
      ],
      "env": {
        "TRANSPORT_TYPE": "stdio",
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "YOUR_READONLY_USER",
        "MYSQL_PASSWORD": "YOUR_PASSWORD",
        "MYSQL_DATABASE": ""
      }
    }
  }
}
```

> **Linux / macOS**：将 `args` 中的路径改为例如 `/home/you/DataRecon-MCP/dist/index.js`。

### 2. 远程 HTTP SSE（需服务端已部署为 `TRANSPORT_TYPE=http-sse`）

请求需携带 **`Accept: application/json, text/event-stream`**；若使用 `AUTH_TYPE=apikey`，请设置 `X-API-Key` 或 `Authorization: Bearer <API_KEY>`。首请求从响应头读取会话 id（如 `mcp-session-id`），后续请求带上该头。

```json
{
  "mcpServers": {
    "datarecon-remote": {
      "url": "https://YOUR_DOMAIN/mcp",
      "headers": {
        "Accept": "application/json, text/event-stream",
        "X-API-Key": "YOUR_LONG_RANDOM_API_KEY"
      }
    }
  }
}
```

若你的客户端不支持在配置里写 `headers`，请在反向代理（如 Nginx）或 API 网关上注入相同请求头。

### 3. 远程 WebSocket（`TRANSPORT_TYPE=websocket`）

```json
{
  "mcpServers": {
    "datarecon-ws": {
      "url": "ws://YOUR_HOST:3848/mcp",
      "headers": {
        "X-API-Key": "YOUR_LONG_RANDOM_API_KEY"
      }
    }
  }
}
```

生产环境请使用 `wss://` 并正确配置 TLS。

---

更多示例见 [`docs/claude-desktop-config.json.example`](./docs/claude-desktop-config.json.example)。

## 测试

```bash
npm test
```

## 许可证

ISC（见 [`package.json`](./package.json)）。
