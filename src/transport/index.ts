import type { AppConfig } from "../config/index.js";
import { createMcpServer } from "../server.js";
import { startStdioServer } from "./stdio.js";
import { startHttpSseServer } from "./http-sse.js";
import { startWebSocketServer } from "./websocket.js";

export async function startTransport(config: AppConfig): Promise<void> {
  switch (config.TRANSPORT_TYPE) {
    case "stdio": {
      const mcp = createMcpServer();
      await startStdioServer(mcp);
      return;
    }
    case "http-sse":
      await startHttpSseServer(config);
      return;
    case "websocket":
      await startWebSocketServer(config);
      return;
  }
}
