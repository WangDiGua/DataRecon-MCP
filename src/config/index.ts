import "dotenv/config";
import { z } from "zod";

/** Treat missing or empty env values as undefined so `.default()` applies (coerce turns `""` into 0). */
function numEnv(defaultValue: number) {
  return z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().default(defaultValue),
  );
}

const envSchema = z.object({
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: numEnv(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_DATABASE: z.string().default(""),

  MAX_QUERY_ROWS: numEnv(200),
  MAX_EXECUTION_TIME: numEnv(5000),
  MAX_EXPLAIN_ROWS: numEnv(1_000_000),
  MAX_SESSION_ROWS: numEnv(5000),
  MAX_SESSION_BYTES: numEnv(10_485_760),

  TRANSPORT_TYPE: z
    .enum(["stdio", "http-sse", "websocket"])
    .default("stdio"),

  HTTP_PORT: numEnv(3000),
  HTTP_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("*"),

  WS_PORT: numEnv(3001),
  WS_HOST: z.string().default("0.0.0.0"),

  AUTH_TYPE: z.enum(["none", "jwt", "apikey"]).default("none"),
  JWT_SECRET: z.string().default("your-secret-key"),
  API_KEY: z.string().default("your-api-key"),

  RATE_LIMIT_WINDOW_MS: numEnv(60_000),
  RATE_LIMIT_MAX: numEnv(100),
});

export type AppConfig = Readonly<z.infer<typeof envSchema>>;

export function loadConfig(): AppConfig {
  return Object.freeze(envSchema.parse(process.env));
}
