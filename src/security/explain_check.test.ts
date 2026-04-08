import { describe, it, expect, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { assertExplainRowEstimate } from "./explain_check.js";

describe("assertExplainRowEstimate", () => {
  it("throws when EXPLAIN rows exceed max", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[], []] as never)
      .mockResolvedValueOnce([[{ rows: 2_000_000 }], []] as never);
    const mockPool = {
      getConnection: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
    };

    await expect(
      assertExplainRowEstimate(
        mockPool as unknown as Pool,
        "db",
        "SELECT 1",
        1_000_000,
      ),
    ).rejects.toThrow(/EXPLAIN_ROW_CEILING/);

    expect(query).toHaveBeenNthCalledWith(1, "USE ??", ["db"]);
  });

  it("passes when under budget", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[], []] as never)
      .mockResolvedValueOnce([[{ rows: 10 }], []] as never);
    const mockPool = {
      getConnection: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
    };

    await assertExplainRowEstimate(
      mockPool as unknown as Pool,
      "db",
      "SELECT 1",
      1_000_000,
    );
  });
});
