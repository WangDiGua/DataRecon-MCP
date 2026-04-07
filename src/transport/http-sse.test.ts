import { describe, it, expect } from "vitest";
import request from "supertest";
import type { AppConfig } from "../config/index.js";
import { buildHttpSseApp } from "./http-sse.js";

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    MYSQL_HOST: "localhost",
    MYSQL_PORT: 3306,
    MYSQL_USER: "u",
    MYSQL_PASSWORD: "p",
    MYSQL_DATABASE: "",
    MAX_QUERY_ROWS: 200,
    MAX_EXECUTION_TIME: 5000,
    MAX_EXPLAIN_ROWS: 1_000_000,
    MAX_SESSION_ROWS: 5000,
    MAX_SESSION_BYTES: 10_485_760,
    TRANSPORT_TYPE: "http-sse",
    HTTP_PORT: 0,
    HTTP_HOST: "127.0.0.1",
    CORS_ORIGIN: "*",
    WS_PORT: 3848,
    WS_HOST: "0.0.0.0",
    AUTH_TYPE: "none",
    JWT_SECRET: "test-secret",
    API_KEY: "test-api-key",
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX: 100,
    DATASOURCE_DENYLIST: [],
    ...overrides,
  };
}

describe("buildHttpSseApp", () => {
  it("GET /health returns 200 and { ok: true } with AUTH_TYPE none", async () => {
    const { app } = buildHttpSseApp(testConfig({ AUTH_TYPE: "none" }));
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
