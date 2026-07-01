import 'dotenv/config';
import express from 'express';
import { webPlugins, tgPlugins } from './config/sources.js';
import { startScheduler } from './core/scheduler/scheduler.js';
import { startTelegramClient } from './core/telegram/tg-client.js';
import { closeMongo, getMongoStatus, initMongo } from './core/storage/mongo.js';

const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Lightweight health endpoint for container/platform checks.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: getMongoStatus(),
    webPlugins: webPlugins.map((plugin) => plugin.id),
    tgPlugins: tgPlugins.map((plugin) => plugin.id),
  });
});

await initMongo();

app.listen(port, () => {
  console.log(`Scraper service listening on port ${port}`);
});

// Start scheduled web scraping and Telegram listeners.
startScheduler(webPlugins);
await startTelegramClient(tgPlugins);

async function shutdown() {
  await closeMongo();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
