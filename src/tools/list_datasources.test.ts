import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RowDataPacket } from "mysql2";

const mockQuery = vi.fn();

vi.mock("../database/connection.js", () => ({
  getPool: () => ({ query: mockQuery }),
}));

vi.mock("../config/index.js", () => ({
  loadConfig: () => ({
    DATASOURCE_DENYLIST: ["banned_extra"],
  }),
}));

import { runListDatasources } from "./list_datasources.js";

describe("runListDatasources", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("filters system DBs, custom denylist, and preserves order from query", async () => {
    mockQuery.mockResolvedValue([
      [
        { Database: "mysql" },
        { Database: "app_db" },
        { Database: "banned_extra" },
        { Database: "information_schema" },
      ] as RowDataPacket[],
      [],
    ]);

    const { databases } = await runListDatasources();
    expect(mockQuery).toHaveBeenCalledWith("SHOW DATABASES");
    expect(databases).toEqual(["app_db"]);
  });
});
