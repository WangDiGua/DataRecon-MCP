import { describe, it, expect } from "vitest";
import { runSqlPreflight } from "./sql_validator.js";

describe("runSqlPreflight", () => {
  it("rejects DELETE", () => {
    expect(() => runSqlPreflight("SELECT 1; DELETE FROM t")).toThrow(/Forbidden/i);
  });

  it("rejects comments", () => {
    expect(() => runSqlPreflight("SELECT 1 -- x")).toThrow(/SQL_COMMENTS_NOT_ALLOWED/);
  });

  it("allows plain SELECT", () => {
    expect(() => runSqlPreflight("SELECT * FROM t")).not.toThrow();
  });
});
