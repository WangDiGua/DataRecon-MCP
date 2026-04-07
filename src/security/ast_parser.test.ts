import { describe, it, expect } from "vitest";
import { assertSelectOnly } from "./ast_parser.js";

describe("assertSelectOnly", () => {
  it("rejects DELETE", () => {
    expect(() => assertSelectOnly("DELETE FROM t")).toThrow(/SELECT/i);
  });

  it("accepts simple SELECT", () => {
    expect(assertSelectOnly("SELECT id FROM users")).toBe("SELECT id FROM users");
  });

  it("rejects LIMIT in SQL", () => {
    expect(() => assertSelectOnly("SELECT * FROM t LIMIT 1")).toThrow(/LIMIT/i);
  });

  it("rejects UNION", () => {
    expect(() => assertSelectOnly("SELECT 1 UNION SELECT 2")).toThrow(/UNION/i);
  });

  it("rejects more than three JOINs", () => {
    const sql =
      "SELECT * FROM a JOIN b ON 1 JOIN c ON 1 JOIN d ON 1 JOIN e ON 1";
    expect(() => assertSelectOnly(sql)).toThrow(/JOIN/i);
  });
});
