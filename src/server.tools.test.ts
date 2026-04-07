import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./server.js";
import { registerTools } from "./tools/index.js";

describe("MCP server skeleton", () => {
  it("createMcpServer returns a server with connect", () => {
    const mcp = createMcpServer();
    expect(typeof mcp.connect).toBe("function");
  });

  it("registerTools does not throw on a fresh McpServer", () => {
    const mcp = new McpServer({ name: "test", version: "0.0.0" });
    expect(() => registerTools(mcp)).not.toThrow();
  });
});
