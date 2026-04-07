import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";

export function createMcpServer(): McpServer {
  const mcp = new McpServer({ name: "datarecon", version: "0.1.0" });
  registerTools(mcp);
  return mcp;
}
