import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { fetchOsmPlaces } from '../core/places/overpass-client.js';
import { createPlacesSync } from '../core/places/places-runtime.js';
import { startPlacesScheduler } from '../core/places/places-scheduler.js';

const mongoUri = process.env.PLACES_MONGO_URI || 'mongodb://mongo:27017/zhytomate';
const bbox = process.env.PLACES_BBOX || '50.20,28.60,50.30,28.75';
const client = new MongoClient(mongoUri);
await client.connect();

const databaseName = new URL(mongoUri).pathname.replace(/^\//, '') || 'zhytomate';
const sync = createPlacesSync({
  bbox,
  collection: client.db(databaseName).collection('places'),
  fetchPlaces: ({ bbox: area }) => fetchOsmPlaces({ bbox: area, endpoint: process.env.OVERPASS_URL }),
});
const task = startPlacesScheduler({ run: sync.run });
console.log(`[places] worker started; schedule=${process.env.PLACES_IMPORT_SCHEDULE || '0 3 * * *'}`);

async function shutdown() {
  task.stop();
  await client.close();
  process.exit(0);
}

process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
