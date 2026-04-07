import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "list_datasources",
    { description: "List MySQL databases (stub)" },
    async () => ({
      content: [{ type: "text", text: "ok" }],
    }),
  );
}
