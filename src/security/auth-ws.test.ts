import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import type { IncomingMessage } from "node:http";
import type { AppConfig } from "../config/index.js";
import { verifyWebSocketUpgrade } from "./auth.js";

function req(url: string, headers?: IncomingMessage["headers"]): IncomingMessage {
  return { url, headers: headers ?? {} } as IncomingMessage;
}

const base = {
  MYSQL_HOST: "h",
  MYSQL_USER: "u",
  MYSQL_PASSWORD: "p",
  MYSQL_DATABASE: "",
  MYSQL_PORT: 3306,
  MAX_QUERY_ROWS: 200,
  MAX_EXECUTION_TIME: 5000,
  MAX_EXPLAIN_ROWS: 1_000_000,
  MAX_SESSION_ROWS: 5000,
  MAX_SESSION_BYTES: 10_485_760,
  TRANSPORT_TYPE: "stdio",
    HTTP_PORT: 3847,
  HTTP_HOST: "0.0.0.0",
  CORS_ORIGIN: "*",
    WS_PORT: 3848,
  WS_HOST: "0.0.0.0",
  JWT_SECRET: "test-jwt-secret",
  API_KEY: "test-api-key",
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 100,
  DATASOURCE_DENYLIST: [],
} as const satisfies Omit<AppConfig, "AUTH_TYPE">;

describe("verifyWebSocketUpgrade", () => {
  it("allows when AUTH_TYPE is none", () => {
    const config = { ...base, AUTH_TYPE: "none" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp"), config);
    expect(r).toEqual({ ok: true });
  });

  it("apikey: allows matching api_key query", () => {
    const config = { ...base, AUTH_TYPE: "apikey" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp?api_key=test-api-key"), config);
    expect(r).toEqual({ ok: true });
  });

  it("apikey: allows matching apiKey query", () => {
    const config = { ...base, AUTH_TYPE: "apikey" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp?apiKey=test-api-key"), config);
    expect(r).toEqual({ ok: true });
  });

  it("apikey: allows Bearer token in Authorization", () => {
    const config = { ...base, AUTH_TYPE: "apikey" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp", { authorization: "Bearer test-api-key" }), config);
    expect(r).toEqual({ ok: true });
  });

  it("apikey: rejects wrong key", () => {
    const config = { ...base, AUTH_TYPE: "apikey" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp?api_key=wrong"), config);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(401);
      expect(r.body).toContain("Unauthorized");
    }
  });

  it("jwt: allows valid token query param", () => {
    const config = { ...base, AUTH_TYPE: "jwt" as const } satisfies AppConfig;
    const token = jwt.sign({ sub: "x" }, config.JWT_SECRET);
    const r = verifyWebSocketUpgrade(req(`/mcp?token=${encodeURIComponent(token)}`), config);
    expect(r).toEqual({ ok: true });
  });

  it("jwt: allows access_token", () => {
    const config = { ...base, AUTH_TYPE: "jwt" as const } satisfies AppConfig;
    const token = jwt.sign({ sub: "x" }, config.JWT_SECRET);
    const r = verifyWebSocketUpgrade(
      req(`/mcp?access_token=${encodeURIComponent(token)}`),
      config,
    );
    expect(r).toEqual({ ok: true });
  });

  it("jwt: rejects missing token", () => {
    const config = { ...base, AUTH_TYPE: "jwt" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp"), config);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(401);
    }
  });

  it("jwt: rejects bad token", () => {
    const config = { ...base, AUTH_TYPE: "jwt" as const } satisfies AppConfig;
    const r = verifyWebSocketUpgrade(req("/mcp?token=not-a-jwt"), config);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(401);
    }
  });
});
