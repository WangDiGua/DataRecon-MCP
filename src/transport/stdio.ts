import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startStdioServer(mcp: McpServer): Promise<void> {
  await mcp.connect(new StdioServerTransport());
}
