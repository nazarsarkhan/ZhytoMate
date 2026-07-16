import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';
import { webPlugins, tgPlugins } from './config/sources.js';
import { startScheduler } from './core/scheduler/scheduler.js';
import { startTelegramClient } from './core/telegram/tg-client.js';
import { closeMongo, getMongoStatus, initMongo } from './core/storage/mongo.js';
import { fetchOsmPlaces } from './core/places/overpass-client.js';
import { createPlacesSync } from './core/places/places-runtime.js';
import { startPlacesScheduler } from './core/places/places-scheduler.js';

const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());

let placesTask = null;
let placesClient = null;
let placesSync = null;

// Lightweight health endpoint for container/platform checks.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: getMongoStatus(),
    places: placesSync?.getStatus() ?? { enabled: false },
    webPlugins: webPlugins.map((plugin) => plugin.id),
    tgPlugins: tgPlugins.map((plugin) => plugin.id),
  });
});

await initMongo();

app.listen(port, () => {
  console.log(`Scraper service listening on port ${port}`);
});

// Start scheduled web scraping and Telegram listeners. Web sources do not require Telegram
// credentials, so a local deployment can still ingest civic/news sites without a TG session.
startScheduler(webPlugins);
if (process.env.TG_API_ID && process.env.TG_API_HASH && process.env.TG_SESSION) {
  await startTelegramClient(tgPlugins);
} else {
  console.warn('Telegram credentials are missing; web sources will continue without Telegram ingestion');
}

if (process.env.PLACES_IMPORT_ENABLED === 'true') {
  const placesUri = process.env.PLACES_MONGO_URI || process.env.MONGO_URI;
  placesClient = new MongoClient(placesUri);
  await placesClient.connect();
  const databaseName = new URL(placesUri).pathname.replace(/^\//, '') || 'zhytomate';
  const collection = placesClient.db(databaseName).collection('places');
  placesSync = createPlacesSync({
    bbox: process.env.PLACES_BBOX || '50.20,28.60,50.30,28.75',
    collection,
    fetchPlaces: ({ bbox }) => fetchOsmPlaces({ bbox, endpoint: process.env.OVERPASS_URL }),
  });
  placesTask = startPlacesScheduler({ run: placesSync.run });
}

async function shutdown() {
  placesTask?.stop();
  await placesClient?.close();
  await closeMongo();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
