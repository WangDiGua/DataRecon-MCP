import WebSocket from "ws";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessageSchema, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

function rawDataToUtf8(data: WebSocket.RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  return Buffer.concat(data).toString("utf8");
}

/**
 * MCP server transport over a single `ws` WebSocket (JSON-RPC per text frame, subprotocol `mcp`).
 */
export class WebSocketConnectionTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private _started = false;
  private readonly _onSocketClose = (): void => {
    this.onclose?.();
  };

  constructor(private readonly socket: WebSocket) {}

  async start(): Promise<void> {
    if (this._started) {
      throw new Error(
        "WebSocketConnectionTransport already started! If using Server class, note that connect() calls start() automatically.",
      );
    }
    this._started = true;

    this.socket.on("message", (data, isBinary) => {
      if (isBinary) {
        this.onerror?.(new Error("Unexpected binary WebSocket frame"));
        return;
      }
      try {
        const text = rawDataToUtf8(data);
        const parsed: unknown = JSON.parse(text);
        const message = JSONRPCMessageSchema.parse(parsed);
        this.onmessage?.(message);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.onerror?.(error);
      }
    });

    this.socket.on("close", this._onSocketClose);
    this.socket.on("error", (err: Error) => {
      this.onerror?.(err);
    });
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not open"));
        return;
      }
      this.socket.send(JSON.stringify(message), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      const { CLOSED, CLOSING } = WebSocket;
      if (this.socket.readyState === CLOSED) {
        resolve();
        return;
      }
      this.socket.once("close", () => {
        resolve();
      });
      if (this.socket.readyState !== CLOSING) {
        this.socket.close();
      }
    });
  }
}
