import { describe, it, expect, vi, afterEach } from "vitest";

describe("loadConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when MYSQL_HOST is missing or empty", async () => {
    vi.stubEnv("MYSQL_HOST", "");
    vi.stubEnv("MYSQL_USER", "u");
    vi.stubEnv("MYSQL_PASSWORD", "p");
    const { loadConfig } = await import("./index.js");
    expect(() => loadConfig()).toThrow();
  });

  it("returns expected defaults with minimal env (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD)", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("MYSQL_HOST", "localhost");
    vi.stubEnv("MYSQL_USER", "u");
    vi.stubEnv("MYSQL_PASSWORD", "p");
    const { loadConfig } = await import("./index.js");
    const c = loadConfig();
    expect(c.TRANSPORT_TYPE).toBe("stdio");
    expect(c.HTTP_PORT).toBe(3000);
    expect(c.WS_PORT).toBe(3001);
    expect(c.MYSQL_PORT).toBe(3306);
    expect(c.AUTH_TYPE).toBe("none");
    expect(c.MAX_QUERY_ROWS).toBe(200);
  });
});
