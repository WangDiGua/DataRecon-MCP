import { describe, it, expect } from "vitest";
import { injectMaxExecutionTimeMs } from "./sql_preprocess.js";

describe("injectMaxExecutionTimeMs", () => {
  it("inserts MAX_EXECUTION_TIME hint after SELECT", () => {
    const out = injectMaxExecutionTimeMs("SELECT 1", 5000);
    expect(out).toMatch(/\/\*\+ MAX_EXECUTION_TIME\(5000\) \*\/\s+1/);
  });
});
