import http from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { verifyWebSocketUpgrade } from "../security/auth.js";
import type { AppConfig } from "../config/index.js";
import { createMcpServer } from "../server.js";
import { WebSocketConnectionTransport } from "./websocket-connection-transport.js";
import { logError } from "../utils/logger.js";

function writeHttpUpgradeError(socket: Duplex, statusCode: number, body: string): void {
  const payload = Buffer.from(body, "utf8");
  const statusText = http.STATUS_CODES[statusCode] ?? "Error";
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
      `Content-Type: application/json; charset=utf-8\r\n` +
      `Content-Length: ${payload.length}\r\n` +
      `Connection: close\r\n` +
      `\r\n`,
  );
  socket.write(payload);
  socket.end();
}

export async function startWebSocketServer(config: AppConfig): Promise<void> {
  const httpServer = http.createServer((_req, res) => {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has("mcp") ? "mcp" : false),
  });

  wss.on("connection", (ws) => {
    const interval = setInterval(() => {
      ws.ping();
    }, 30_000);
    ws.on("close", () => {
      clearInterval(interval);
    });

    void (async () => {
      const transport = new WebSocketConnectionTransport(ws);
      const mcp = createMcpServer();
      try {
        await mcp.connect(transport);
      } catch (err) {
        logError("websocket mcp connect", {
          err: err instanceof Error ? err.message : String(err),
        });
        ws.close();
      }
    })();
  });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/mcp") {
      socket.destroy();
      return;
    }
    const auth = verifyWebSocketUpgrade(req, config);
    if (!auth.ok) {
      writeHttpUpgradeError(socket, auth.statusCode, auth.body);
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws, upgradeReq) => {
      wss.emit("connection", ws, upgradeReq);
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(config.WS_PORT, config.WS_HOST, () => {
      resolve();
    });
    httpServer.on("error", reject);
  });

  const shutdown = (): void => {
    void new Promise<void>((resolve) => {
      wss.close(() => resolve());
    })
      .then(
        () =>
          new Promise<void>((resolve) => {
            httpServer.close(() => resolve());
          }),
      )
      .then(() => {
        process.exit(0);
      });
  };
  process.once("SIGINT", shutdown);
}
