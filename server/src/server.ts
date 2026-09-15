import { app } from "./app.js";
import { env } from "./shared/lib/env.js";
import { logger } from "./shared/lib/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
