import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config/index.js";
import { startStdioServer } from "./stdio.js";

export async function startTransport(
  mcp: McpServer,
  transportType: AppConfig["TRANSPORT_TYPE"],
): Promise<void> {
  switch (transportType) {
    case "stdio":
      await startStdioServer(mcp);
      return;
    case "http-sse":
    case "websocket":
      throw new Error(`TRANSPORT_TYPE not implemented: ${transportType}`);
  }
}
