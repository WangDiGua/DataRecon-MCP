import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { AppConfig } from "../config/index.js";

/** Bearer token from `Authorization` header (no "Bearer " prefix). */
export function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }
  return authHeader.slice("Bearer ".length);
}

export function verifyJwtToken(token: string, secret: string): void {
  jwt.verify(token, secret);
}

export function verifyApiKeyValue(provided: string | undefined, expected: string): boolean {
  return provided !== undefined && provided === expected;
}

/** API key from `X-API-Key` or `Authorization: Bearer <key>`. */
export function extractApiKeyFromHttpHeaders(
  headers: IncomingMessage["headers"],
): string | undefined {
  const headerKey = headers["x-api-key"];
  const fromHeader =
    typeof headerKey === "string"
      ? headerKey
      : Array.isArray(headerKey)
        ? headerKey[0]
        : undefined;
  return fromHeader ?? extractBearerToken(headers.authorization);
}

export type WebSocketUpgradeAuthResult =
  | { ok: true }
  | { ok: false; statusCode: number; body: string };

/**
 * Validates auth for an HTTP `upgrade` request before accepting a WebSocket.
 */
export function verifyWebSocketUpgrade(
  req: IncomingMessage,
  config: AppConfig,
): WebSocketUpgradeAuthResult {
  if (config.AUTH_TYPE === "none") {
    return { ok: true };
  }

  const url = new URL(req.url ?? "/", "http://localhost");

  if (config.AUTH_TYPE === "jwt") {
    const token =
      url.searchParams.get("token") ?? url.searchParams.get("access_token");
    if (!token) {
      return {
        ok: false,
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
    try {
      verifyJwtToken(token, config.JWT_SECRET);
      return { ok: true };
    } catch {
      return {
        ok: false,
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
  }

  const fromQuery =
    url.searchParams.get("api_key") ?? url.searchParams.get("apiKey");
  const fromBearer = extractBearerToken(req.headers.authorization);
  const key = fromQuery ?? fromBearer;
  if (verifyApiKeyValue(key, config.API_KEY)) {
    return { ok: true };
  }
  return {
    ok: false,
    statusCode: 401,
    body: JSON.stringify({ error: "Unauthorized" }),
  };
}

export function createAuthMiddleware(config: AppConfig): RequestHandler {
  if (config.AUTH_TYPE === "none") {
    return (_req, _res, next) => {
      next();
    };
  }

  if (config.AUTH_TYPE === "jwt") {
    return (req, res, next) => {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      try {
        verifyJwtToken(token, config.JWT_SECRET);
        next();
      } catch {
        res.status(401).json({ error: "Unauthorized" });
      }
    };
  }

  return (req, res, next) => {
    const key = extractApiKeyFromHttpHeaders(req.headers);
    if (verifyApiKeyValue(key, config.API_KEY)) {
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
  };
}
