import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { AppConfig } from "../config/index.js";

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
      jwt.verify(token, config.JWT_SECRET);
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
  const auth = req.headers.authorization;
  const fromBearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;
  const key = fromQuery ?? fromBearer;
  if (key === config.API_KEY) {
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
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const token = auth.slice("Bearer ".length);
      try {
        jwt.verify(token, config.JWT_SECRET);
        next();
      } catch {
        res.status(401).json({ error: "Unauthorized" });
      }
    };
  }

  return (req, res, next) => {
    const headerKey = req.headers["x-api-key"];
    const fromHeader =
      typeof headerKey === "string"
        ? headerKey
        : Array.isArray(headerKey)
          ? headerKey[0]
          : undefined;
    const auth = req.headers.authorization;
    const fromBearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;
    const key = fromHeader ?? fromBearer;
    if (key === config.API_KEY) {
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
  };
}
