import { config } from "./config/index.js";
import { createApp } from "./app.js";
import { connectMongo, disconnectMongo } from "./shared/db.js";
import { startOutageSync } from "./features/outage/outage.sync.js";

async function bootstrap() {
  await connectMongo();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on :${config.port} (env=${config.env})`);
  });
  const stopOutageSync = startOutageSync();

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    stopOutageSync();
    server.close();
    await disconnectMongo();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
