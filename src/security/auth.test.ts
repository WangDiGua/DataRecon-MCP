import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import {
  extractApiKeyFromHttpHeaders,
  extractBearerToken,
  verifyApiKeyValue,
  verifyJwtToken,
} from "./auth.js";

describe("extractBearerToken", () => {
  it("returns token without prefix", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("returns undefined when missing or malformed", () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken("Basic x")).toBeUndefined();
  });
});

describe("verifyJwtToken", () => {
  const secret = "s3cret";

  it("accepts valid token", () => {
    const t = jwt.sign({ sub: "1" }, secret);
    expect(() => verifyJwtToken(t, secret)).not.toThrow();
  });

  it("throws on invalid token", () => {
    expect(() => verifyJwtToken("not-a-jwt", secret)).toThrow();
  });
});

describe("verifyApiKeyValue", () => {
  it("matches exact key", () => {
    expect(verifyApiKeyValue("k", "k")).toBe(true);
    expect(verifyApiKeyValue("x", "k")).toBe(false);
    expect(verifyApiKeyValue(undefined, "k")).toBe(false);
  });
});

describe("extractApiKeyFromHttpHeaders", () => {
  it("prefers X-API-Key over Bearer", () => {
    const h = {
      "x-api-key": "from-header",
      authorization: "Bearer from-bearer",
    };
    expect(extractApiKeyFromHttpHeaders(h)).toBe("from-header");
  });

  it("falls back to Bearer", () => {
    expect(
      extractApiKeyFromHttpHeaders({
        authorization: "Bearer only-this",
      }),
    ).toBe("only-this");
  });
});
