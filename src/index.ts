import { initLogger, logError } from "./utils/logger.js";
import { loadConfig } from "./config/index.js";
import { startTransport } from "./transport/index.js";

async function main(): Promise<void> {
  initLogger();
  const config = loadConfig();
  await startTransport(config);
}

main().catch((err: unknown) => {
  logError("fatal", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
