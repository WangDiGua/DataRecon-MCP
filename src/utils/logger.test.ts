import { afterEach, describe, expect, it, vi } from "vitest";
import {
  auditQuery,
  initLogger,
  logInfo,
  resetLogger,
} from "./logger.js";

describe("logger", () => {
  afterEach(() => {
    resetLogger();
    vi.restoreAllMocks();
  });

  it("logInfo writes JSON to stderr with level info", () => {
    const chunks: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    logInfo("hello", { foo: 1 });

    const out = chunks.join("");
    expect(out).toContain('"level":"info"');
    expect(out).toContain('"msg":"hello"');
    expect(out).toContain('"foo":1');
  });

  it("after initLogger, console.log goes to stderr as info JSON", () => {
    const chunks: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    initLogger();
    console.log("x");

    const out = chunks.join("");
    expect(out).toContain('"level":"info"');
    expect(out).toContain('"msg":"x"');
  });

  it("auditQuery truncates sql and includes audit fields", () => {
    const chunks: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    const longSql = "a".repeat(2100);
    auditQuery(longSql, {
      sessionId: "s1",
      traceId: "t1",
      extra: true,
    });

    const line = chunks.join("").trim();
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.type).toBe("audit.query");
    expect(String(parsed.sql).length).toBe(2000);
    expect(parsed.sessionId).toBe("s1");
    expect(parsed.traceId).toBe("t1");
    expect(parsed.extra).toBe(true);
  });
});
