import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager, resetSessionManagerForTests } from "./session_manager.js";

describe("SessionManager", () => {
  beforeEach(() => {
    resetSessionManagerForTests();
  });

  it("stores rows and counts", () => {
    const sm = new SessionManager(100, 100_000);
    sm.store("s1", [{ a: 1 }, { a: 2 }]);
    expect(sm.count("s1")).toBe(2);
  });

  it("replaces same session id", () => {
    const sm = new SessionManager(100, 100_000);
    sm.store("s1", [{ x: 1 }]);
    sm.store("s1", [{ x: 2 }, { x: 3 }]);
    expect(sm.count("s1")).toBe(2);
  });

  it("evicts LRU when global row cap would be exceeded", () => {
    const sm = new SessionManager(3, 100_000);
    sm.store("a", [{ n: 1 }]);
    sm.store("b", [{ n: 2 }]);
    sm.getRows("a");
    sm.store("c", [{ n: 3 }]);
    sm.store("d", [{ n: 4 }]);
    expect(() => sm.getRows("b")).toThrow();
    expect(sm.count("a")).toBe(1);
    expect(sm.count("d")).toBe(1);
  });

  it("sum avg groupBy", () => {
    const sm = new SessionManager(100, 100_000);
    sm.store("s", [
      { g: "x", v: 10 },
      { g: "x", v: 20 },
      { g: "y", v: 5 },
    ]);
    expect(sm.sum("s", "v")).toBe(35);
    expect(sm.avg("s", "v")).toBeCloseTo(35 / 3);
    expect(sm.groupByCount("s", "g")).toEqual({ x: 2, y: 1 });
  });
});
