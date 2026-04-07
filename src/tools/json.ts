/** JSON for MCP text responses; serializes bigint. */
export function toToolJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}
