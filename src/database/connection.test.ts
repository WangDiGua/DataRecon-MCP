import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "mysql2/promise";

const mockCreatePool = vi.hoisted(() => vi.fn());

vi.mock("mysql2/promise", () => ({
  createPool: mockCreatePool,
}));

import { createPool } from "mysql2/promise";
import {
  healthCheck,
  setPoolForTests,
} from "./connection.js";

describe("database connection", () => {
  beforeEach(() => {
    vi.stubEnv("MYSQL_HOST", "localhost");
    vi.stubEnv("MYSQL_USER", "u");
    vi.stubEnv("MYSQL_PASSWORD", "p");
    setPoolForTests(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setPoolForTests(undefined);
    vi.clearAllMocks();
  });

  describe("healthCheck", () => {
    it("returns true when query succeeds", async () => {
      const query = vi
        .fn()
        .mockResolvedValue([[{ "1": 1 }], []] as unknown as never);
      mockCreatePool.mockReturnValue({ query } as unknown as Pool);

      await expect(healthCheck()).resolves.toBe(true);
      expect(query).toHaveBeenCalledWith("SELECT 1");
      expect(createPool).toHaveBeenCalled();
    });

    it("returns false when query throws", async () => {
      const query = vi.fn().mockRejectedValue(new Error("connection refused"));
      mockCreatePool.mockReturnValue({ query } as unknown as Pool);

      await expect(healthCheck()).resolves.toBe(false);
      expect(query).toHaveBeenCalledWith("SELECT 1");
    });
  });
});
