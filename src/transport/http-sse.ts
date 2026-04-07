import { randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createAuthMiddleware } from "../security/auth.js";
import type { AppConfig } from "../config/index.js";
import { createMcpServer } from "../server.js";
import { logError } from "../utils/logger.js";

export interface HttpSseApp {
  app: Express;
  closeAllTransports: () => Promise<void>;
}

export function buildHttpSseApp(config: AppConfig): HttpSseApp {
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const app = createMcpExpressApp({ host: config.HTTP_HOST });

  app.use(
    cors({
      origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN,
      credentials: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const mcpRateLimit = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const auth = createAuthMiddleware(config);

  const mcpPostHandler: RequestHandler = async (req, res) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionHeader === "string"
        ? sessionHeader
        : Array.isArray(sessionHeader)
          ? sessionHeader[0]
          : undefined;

    try {
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport!;
          },
        });
        transport.onclose = () => {
          const sid = transport!.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
          }
        };
        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32_000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logError("mcp post", {
        err: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32_603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  };

  const mcpGetHandler: RequestHandler = async (req, res) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionHeader === "string"
        ? sessionHeader
        : Array.isArray(sessionHeader)
          ? sessionHeader[0]
          : undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (err) {
      logError("mcp get", {
        err: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  };

  const mcpDeleteHandler: RequestHandler = async (req, res) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionHeader === "string"
        ? sessionHeader
        : Array.isArray(sessionHeader)
          ? sessionHeader[0]
          : undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (err) {
      logError("mcp delete", {
        err: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  };

  app.post("/mcp", mcpRateLimit, auth, mcpPostHandler);
  app.get("/mcp", mcpRateLimit, auth, mcpGetHandler);
  app.delete("/mcp", mcpRateLimit, auth, mcpDeleteHandler);

  async function closeAllTransports(): Promise<void> {
    for (const sid of Object.keys(transports)) {
      try {
        await transports[sid].close();
        delete transports[sid];
      } catch (err) {
        logError("transport close", {
          sessionId: sid,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { app, closeAllTransports };
}

export async function startHttpSseServer(config: AppConfig): Promise<void> {
  const { app, closeAllTransports } = buildHttpSseApp(config);

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.HTTP_PORT, config.HTTP_HOST, () => {
      resolve();
    });
    server.on("error", reject);
  });

  const onSigint = async () => {
    await closeAllTransports();
    process.exit(0);
  };
  process.once("SIGINT", onSigint);
}
