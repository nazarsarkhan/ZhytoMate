import { MongoClient } from 'mongodb';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchOsmPlaces } from '../core/places/overpass-client.js';

const DEFAULT_BBOX = '50.20,28.60,50.30,28.75';

export async function importPlaces({ bbox, fetchPlaces = fetchOsmPlaces, collection }) {
  const places = await fetchPlaces({ bbox });
  if (!collection) throw new Error('Mongo collection is required');
  if (!places.length) return { imported: 0 };
  const now = new Date();
  const operations = places.map((place) => ({
    updateOne: {
      filter: { sourceId: place.sourceId },
      update: {
        $set: {
          ...place,
          location: { type: 'Point', coordinates: [place.longitude, place.latitude] },
          catalogUpdatedAt: now,
        },
      },
      upsert: true,
    },
  }));
  await collection.bulkWrite(operations, { ordered: false });
  // A successful scoped import is authoritative for the OSM catalog. Remove records from older
  // broad-bbox imports, but keep manually curated/non-OSM places and preserve the catalog when
  // the fetch itself returns no data or throws before this point.
  if (typeof collection.deleteMany === 'function') {
    await collection.deleteMany({ source: 'openstreetmap', sourceId: { $nin: places.map(({ sourceId }) => sourceId) } });
  }
  return { imported: places.length };
}

async function main() {
  const mongoUri = process.env.PLACES_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/future_in_action_scraper';
  const bbox = process.env.PLACES_BBOX || DEFAULT_BBOX;
  if (process.env.PLACES_IMPORT_DRY_RUN === 'true') {
    const places = await fetchOsmPlaces({ bbox, endpoint: process.env.OVERPASS_URL });
    console.log(JSON.stringify({ imported: places.length, dryRun: true }));
    return;
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const dbName = new URL(mongoUri).pathname.replace(/^\//, '') || 'future_in_action_scraper';
    const collection = client.db(dbName).collection('places');
    await collection.createIndex({ sourceId: 1 }, { unique: true });
    await collection.createIndex({ location: '2dsphere' });
    const result = await importPlaces({ bbox, collection });
    console.log(JSON.stringify(result));
  } finally {
    await client.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
