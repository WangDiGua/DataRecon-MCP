# DataRecon-MCP 开发计划

## 项目概述

基于 Node.js (TypeScript) 的 MCP (Model Context Protocol) 插件，为大模型提供 MySQL 数据库探查能力。

### 核心特性
- 强制分页查询
- 原始报错透传
- 临时内存计算
- 多层安全防护
- **多传输方式支持**（Stdio / HTTP-SSE / WebSocket）

---

## 一、项目初始化

### 1.1 创建项目结构
```
DataRecon-MCP/
├── src/
│   ├── index.ts              # 入口文件（根据配置选择传输方式）
│   ├── server.ts             # MCP Server 核心逻辑
│   ├── config/
│   │   └── index.ts          # 配置管理
│   ├── transport/
│   │   ├── index.ts          # 传输层工厂
│   │   ├── stdio.ts          # Stdio 传输（本地使用）
│   │   ├── http-sse.ts       # HTTP/SSE 传输（远程服务）
│   │   └── websocket.ts      # WebSocket 传输（实时双向）
│   ├── database/
│   │   ├── connection.ts     # 数据库连接池
│   │   └── pool.ts           # 连接池管理
│   ├── tools/
│   │   ├── index.ts          # 工具注册
│   │   ├── list_datasources.ts
│   │   ├── get_table_list.ts
│   │   ├── get_table_schema.ts
│   │   ├── execute_query.ts
│   │   ├── store_to_memory.ts
│   │   └── analyze_memory.ts
│   ├── security/
│   │   ├── ast_parser.ts     # AST 语法解析
│   │   ├── sql_validator.ts  # SQL 安全校验
│   │   ├── explain_check.ts  # EXPLAIN 预检
│   │   ├── error_filter.ts   # 错误信息过滤
│   │   └── auth.ts           # HTTP 认证中间件
│   ├── memory/
│   │   └── session_manager.ts # 会话内存管理
│   └── utils/
│       ├── logger.ts         # 日志工具
│       └── constants.ts      # 常量定义
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

### 1.2 依赖安装

#### 核心依赖
- `@modelcontextprotocol/sdk` - MCP 核心通讯
- `mysql2` - MySQL 驱动（支持 Promise）
- `zod` - 参数 Schema 校验
- `dotenv` - 环境变量管理
- `node-sql-parser` - SQL AST 解析
- `lru-cache` - LRU 缓存

#### 传输层依赖（按需安装）
- `express` - HTTP 服务器（HTTP-SSE 传输）
- `cors` - CORS 支持
- `ws` - WebSocket 服务器
- `express-rate-limit` - 请求频率限制（HTTP 方式必需）

#### 认证依赖（HTTP 方式）
- `jsonwebtoken` - JWT 认证
- `bcryptjs` - 密码哈希（可选，用于 API Key 验证）

### 1.3 TypeScript 配置
- 目标 ES2020
- 启用严格模式
- 输出目录 dist/

---

## 二、传输层设计（多调用方式）

### 2.1 传输方式对比

| 传输方式 | 使用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| **Stdio** | 本地客户端（Claude Desktop） | 简单、安全、无网络暴露 | 仅限本地 |
| **HTTP-SSE** | 远程 Web 应用、API 服务 | 兼容性好、易集成 | 需要认证 |
| **WebSocket** | 实时应用、流式响应 | 双向通信、低延迟 | 实现复杂 |

### 2.2 Transport 层实现

#### `src/transport/index.ts` - 传输层工厂
**任务**:
- [ ] 定义 Transport 接口
- [ ] 根据配置创建对应传输实例
- [ ] 统一错误处理

#### `src/transport/stdio.ts` - Stdio 传输
**任务**:
- [ ] 使用 `StdioServerTransport`
- [ ] 标准输入输出处理
- [ ] 适合 Claude Desktop 本地调用

#### `src/transport/http-sse.ts` - HTTP/SSE 传输
**任务**:
- [ ] 创建 Express 服务器
- [ ] 实现 SSE (Server-Sent Events) 端点
- [ ] CORS 配置
- [ ] Rate Limiting（频率限制）
- [ ] JWT/API Key 认证中间件
- [ ] 健康检查端点

#### `src/transport/websocket.ts` - WebSocket 传输
**任务**:
- [ ] 创建 WebSocket 服务器
- [ ] 连接管理
- [ ] 消息序列化/反序列化
- [ ] 心跳检测
- [ ] 认证握手

### 2.3 认证模块（HTTP/WebSocket 方式必需）

#### `src/security/auth.ts`
**任务**:
- [ ] JWT Token 验证
- [ ] API Key 验证
- [ ] 请求签名验证（可选）
- [ ] IP 白名单（可选）

---

## 三、核心模块开发

### 3.1 MCP Server 核心
**文件**: `src/server.ts`

**任务**:
- [ ] 初始化 MCP Server 实例
- [ ] 注册所有工具
- [ ] 实现工具调用分发逻辑
- [ ] 错误边界处理
- [ ] 与传输层解耦

### 3.2 Database 适配层
**文件**: `src/database/connection.ts`, `src/database/pool.ts`

**任务**:
- [ ] 创建 mysql2 连接池
- [ ] 配置只读账号连接
- [ ] 设置 `multipleStatements: false`
- [ ] 实现连接健康检查
- [ ] 空闲连接自动销毁

### 3.3 Memory 缓冲区
**文件**: `src/memory/session_manager.ts`

**任务**:
- [ ] 实现 SessionManager 类
- [ ] 基于 Map 的会话存储
- [ ] 双重配额管理（行数 + 字节）
- [ ] LRU 淘汰策略
- [ ] 聚合计算方法（sum/avg/count/group_by）

---

## 四、工具集实现

### 4.1 探测阶段工具

#### `list_datasources`
**文件**: `src/tools/list_datasources.ts`

**功能**: 获取所有数据库清单

**任务**:
- [ ] 执行 `SHOW DATABASES`
- [ ] 过滤系统库（mysql, information_schema, performance_schema, sys）
- [ ] 应用动态黑名单

#### `get_table_list`
**文件**: `src/tools/get_table_list.ts`

**功能**: 获取指定库的所有表

**任务**:
- [ ] 查询 `information_schema.TABLES`
- [ ] 过滤敏感表名（user, config, secret, salary, password 等）
- [ ] 返回表名和 COMMENT

#### `get_table_schema`
**文件**: `src/tools/get_table_schema.ts`

**功能**: 获取表的详细结构

**任务**:
- [ ] 查询 `information_schema.COLUMNS`
- [ ] 查询 `information_schema.STATISTICS` 获取索引
- [ ] 敏感字段脱敏（类型改为 HIDDEN）
- [ ] 返回列定义、类型、索引、注释

### 4.2 执行与分析工具

#### `execute_query` (核心)
**文件**: `src/tools/execute_query.ts`

**功能**: 执行 SELECT 查询

**任务**:
- [ ] 参数校验（db_name, sql, limit, offset）
- [ ] SQL 安全检查流程
- [ ] 强制分页包装
- [ ] 执行查询
- [ ] 返回结果和分页元数据

#### `store_to_memory`
**文件**: `src/tools/store_to_memory.ts`

**功能**: 暂存数据到内存

**任务**:
- [ ] 生成/验证 session_id
- [ ] 字节大小预估
- [ ] 配额检查
- [ ] 存入 SessionManager

#### `analyze_memory`
**文件**: `src/tools/analyze_memory.ts`

**功能**: 对内存数据执行聚合计算

**任务**:
- [ ] 获取 session 数据
- [ ] 执行聚合操作（sum/avg/count/group_by）
- [ ] 返回计算结果

---

## 五、安全防护模块

### 5.1 AST 语法解析器
**文件**: `src/security/ast_parser.ts`

**任务**:
- [ ] 使用 `node-sql-parser` 解析 SQL
- [ ] 验证 Statement Type 必须为 SELECT
- [ ] 检测多语句注入
- [ ] 分析 JOIN 层级深度（限制 3 层）
- [ ] 强制插入 LIMIT 子句（AST 级别）

### 5.2 SQL 安全校验
**文件**: `src/security/sql_validator.ts`

**任务**:
- [ ] 正则预检（DELETE/UPDATE/DROP/ALTER/INSERT 等）
- [ ] 注释符检测
- [ ] UNION 注入检测
- [ ] 子查询深度检测

### 5.3 EXPLAIN 预检
**文件**: `src/security/explain_check.ts`

**任务**:
- [ ] 执行 `EXPLAIN` 分析
- [ ] 解析预估扫描行数
- [ ] 行数阈值检查（限制 100 万行）
- [ ] 成本评估

### 5.4 错误信息过滤
**文件**: `src/security/error_filter.ts`

**任务**:
- [ ] 错误分类（业务错误 vs 系统错误）
- [ ] 业务错误透传（字段名错误等）
- [ ] 系统错误脱敏（连接超时、权限拒绝等）
- [ ] 隐藏内网 IP、版本号等敏感信息

### 5.5 SQL 预处理层
**任务**:
- [ ] 注入 `MAX_EXECUTION_TIME(5000)` 超时提示
- [ ] 去除末尾分号
- [ ] AST 级别 LIMIT 重写

---

## 六、配置与常量

### 6.1 环境变量
```env
# 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=readonly_user
MYSQL_PASSWORD=readonly_password
MYSQL_DATABASE=

# 查询限制
MAX_QUERY_ROWS=200
MAX_EXECUTION_TIME=5000
MAX_EXPLAIN_ROWS=1000000
MAX_SESSION_ROWS=5000
MAX_SESSION_BYTES=10485760

# 传输方式配置
TRANSPORT_TYPE=stdio    # stdio | http-sse | websocket

# HTTP/SSE 配置（TRANSPORT_TYPE=http-sse 时需要）
HTTP_PORT=3000
HTTP_HOST=0.0.0.0
CORS_ORIGIN=*

# WebSocket 配置（TRANSPORT_TYPE=websocket 时需要）
WS_PORT=3001
WS_HOST=0.0.0.0

# 认证配置（HTTP/WebSocket 方式需要）
AUTH_TYPE=none          # none | jwt | apikey
JWT_SECRET=your-secret-key
API_KEY=your-api-key

# Rate Limiting（HTTP 方式）
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### 6.2 安全常量
**文件**: `src/utils/constants.ts`

**任务**:
- [ ] 系统库黑名单
- [ ] 敏感表名关键词
- [ ] 敏感字段名关键词
- [ ] 业务错误码白名单

---

## 七、日志与审计

### 7.1 日志工具
**文件**: `src/utils/logger.ts`

**任务**:
- [ ] 强制输出到 stderr（避免干扰 MCP 通信）
- [ ] 拦截 console.log
- [ ] 结构化日志格式
- [ ] 查询审计日志
- [ ] 请求追踪（HTTP/WebSocket 方式）

---

## 八、测试与部署

### 8.1 单元测试
- [ ] SQL 解析器测试
- [ ] 安全校验测试
- [ ] 内存管理测试
- [ ] 错误过滤测试
- [ ] 认证模块测试

### 8.2 集成测试
- [ ] MCP 工具调用测试
- [ ] 数据库连接测试
- [ ] 端到端查询测试
- [ ] HTTP/SSE 传输测试
- [ ] WebSocket 传输测试

### 8.3 部署配置
- [ ] Claude Desktop 配置示例（Stdio）
- [ ] HTTP 服务部署示例
- [ ] Dockerfile（多传输方式支持）
- [ ] docker-compose.yml
- [ ] 环境变量文档

---

## 九、开发顺序

### Phase 1: 基础框架
1. 项目初始化（package.json, tsconfig.json）
2. 配置管理模块
3. 数据库连接池
4. MCP Server 核心框架

### Phase 2: 传输层
5. Stdio 传输实现
6. HTTP/SSE 传输实现
7. WebSocket 传输实现
8. 认证模块

### Phase 3: 核心工具
9. list_datasources 工具
10. get_table_list 工具
11. get_table_schema 工具
12. execute_query 工具（基础版）

### Phase 4: 安全防护
13. AST 解析器
14. SQL 安全校验
15. EXPLAIN 预检
16. 错误过滤
17. execute_query 增强（集成安全模块）

### Phase 5: 内存管理
18. SessionManager 实现
19. store_to_memory 工具
20. analyze_memory 工具

### Phase 6: 完善与测试
21. 日志与审计
22. 单元测试
23. 集成测试
24. 文档与部署配置

---

## 十、关键安全检查清单

| 风险维度 | 防御技术 | 实现位置 | 状态 |
|---------|---------|---------|------|
| 写操作 | 只读账号 + 正则检测 | 数据库层 + SQL校验 | [ ] |
| 执行过久 | MAX_EXECUTION_TIME 注入 | SQL 预处理层 | [ ] |
| 逻辑越权 | AST 语法分析 (Only SELECT) | Security 层 | [ ] |
| DoS 攻击 | EXPLAIN 预检 + JOIN 限制 | Security 层 | [ ] |
| SQL 注入 | AST 重写 LIMIT | Security 层 | [ ] |
| 数据过大 | LRU-Cache + 字节配额 | Memory 层 | [ ] |
| 连接泄漏 | 连接池自动销毁 | Database 层 | [ ] |
| 权限泄露 | 黑名单过滤 + 字段脱敏 | Tools 层 | [ ] |
| 信息泄露 | 错误分类过滤 | Security 层 | [ ] |
| 协议破坏 | console.log 重定向 stderr | 全局拦截 | [ ] |
| **未授权访问** | JWT/API Key 认证 | Transport 层 | [ ] |
| **频率攻击** | Rate Limiting | HTTP 传输层 | [ ] |

---

## 十一、调用方式示例

### 11.1 Stdio 方式（Claude Desktop）
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "datarecon": {
      "command": "node",
      "args": ["/path/to/DataRecon-MCP/dist/index.js"],
      "env": {
        "TRANSPORT_TYPE": "stdio",
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "readonly_user",
        "MYSQL_PASSWORD": "readonly_password"
      }
    }
  }
}
```

### 11.2 HTTP/SSE 方式
```bash
# 启动服务
TRANSPORT_TYPE=http-sse HTTP_PORT=3000 node dist/index.js

# 客户端调用
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "list_datasources"}}'
```

### 11.3 WebSocket 方式
```javascript
// 客户端代码
const ws = new WebSocket('ws://localhost:3001/mcp');
ws.on('open', () => {
  ws.send(JSON.stringify({
    method: 'tools/call',
    params: { name: 'list_datasources' }
  }));
});
```

---

## 十二、预期产出

1. **可运行的 MCP Server**：支持 Stdio / HTTP-SSE / WebSocket 三种传输方式
2. **6 个核心工具**：完整的数据库探查能力
3. **多层安全防护**：从数据库权限到 AST 解析的纵深防御
4. **灵活的部署方式**：本地使用或远程服务部署
5. **完善的文档**：配置说明、部署指南、安全说明
