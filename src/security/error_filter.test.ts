import { describe, it, expect } from "vitest";
import { filterMysqlError, withMysqlErrorFilter } from "./error_filter.js";

describe("filterMysqlError", () => {
  it("passes through business SQL errors", () => {
    const err = Object.assign(new Error("Unknown column"), {
      errno: 1054,
      sqlMessage: "Unknown column 'x' in 'field list'",
    });
    const out = filterMysqlError(err);
    expect(out.message).toContain("Unknown column");
  });

  it("sanitizes access denied", () => {
    const err = Object.assign(new Error("Access denied"), {
      errno: 1045,
      sqlMessage: "Access denied for user",
    });
    const out = filterMysqlError(err);
    expect(out.message).toMatch(/permission|connection/i);
    expect(out.message).not.toContain("Access denied for user");
  });

  it("withMysqlErrorFilter maps rejection through filterMysqlError", async () => {
    const err = Object.assign(new Error("nope"), { errno: 1054, sqlMessage: "Unknown column 'x'" });
    await expect(
      withMysqlErrorFilter(async () => {
        throw err;
      }),
    ).rejects.toThrow(/MYSQL_BUSINESS_ERRNO_1054/);
  });
});
