import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';

const defaultMongoUri = 'mongodb://127.0.0.1:27017';
const defaultDbName = 'future_in_action_scraper';
const defaultCollectionName = 'scraped_items';
const defaultReservationTtlMinutes = 30;

let client;
let collection;

function getMongoUri() {
  return process.env.MONGO_URI || defaultMongoUri;
}

function getDbName() {
  return process.env.MONGO_DB || defaultDbName;
}

function getCollectionName() {
  return process.env.MONGO_COLLECTION || defaultCollectionName;
}

function isDedupeEnabled() {
  return process.env.SCRAPER_DEDUPE_ENABLED !== 'false';
}

function getReservationTtlMs() {
  const minutes = Number(process.env.SCRAPER_DEDUPE_RESERVATION_TTL_MINUTES);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0
    ? minutes
    : defaultReservationTtlMinutes;

  return safeMinutes * 60 * 1000;
}

function hashText(value) {
  return crypto.createHash('sha256').update(value || '').digest('hex');
}

export function getDedupeKey(item) {
  if (item.url) {
    return `${item.source}:${item.type}:url:${item.url}`;
  }

  return [
    item.source,
    item.type,
    'content',
    item.publishedAt,
    hashText(item.body),
  ].join(':');
}

export async function initMongo() {
  if (!isDedupeEnabled()) {
    console.log('Mongo dedupe disabled');
    return null;
  }

  if (collection) {
    return collection;
  }

  client = new MongoClient(getMongoUri());
  await client.connect();

  const db = client.db(getDbName());
  collection = db.collection(getCollectionName());

  await collection.createIndex({ dedupeKey: 1 }, { unique: true });
  await collection.createIndex({ source: 1, type: 1, publishedAt: -1 });
  await collection.createIndex({ status: 1, reservedAt: 1 });

  console.log(`Mongo dedupe ready: ${getDbName()}.${getCollectionName()}`);
  return collection;
}

export async function reserveScrapedItem(item) {
  if (!isDedupeEnabled()) {
    return true;
  }

  const items = await initMongo();
  const dedupeKey = getDedupeKey(item);
  const now = new Date();

  try {
    await items.insertOne({
      dedupeKey,
      source: item.source,
      type: item.type,
      url: item.url || null,
      publishedAt: item.publishedAt,
      bodyHash: hashText(item.body),
      status: 'reserved',
      reservedAt: now,
      deliveredAt: null,
      item,
    });

    return true;
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const existing = await items.findOne({ dedupeKey });

    if (!existing || existing.status !== 'reserved') {
      return false;
    }

    const reservedAt = existing.reservedAt?.getTime?.() || 0;
    const isStale = Date.now() - reservedAt > getReservationTtlMs();

    if (!isStale) {
      return false;
    }

    const result = await items.updateOne(
      { dedupeKey, status: 'reserved', reservedAt: existing.reservedAt },
      {
        $set: {
          reservedAt: now,
          item,
        },
        $inc: {
          reservationRetries: 1,
        },
      },
    );

    return result.modifiedCount === 1;
  }
}

export async function markScrapedItemDelivered(item) {
  if (!isDedupeEnabled()) {
    return;
  }

  const items = await initMongo();
  await items.updateOne(
    { dedupeKey: getDedupeKey(item) },
    {
      $set: {
        status: 'delivered',
        deliveredAt: new Date(),
      },
    },
  );
}

export async function releaseScrapedItemReservation(item) {
  if (!isDedupeEnabled()) {
    return;
  }

  const items = await initMongo();
  await items.deleteOne({
    dedupeKey: getDedupeKey(item),
    status: 'reserved',
  });
}

export function getMongoStatus() {
  return {
    dedupeEnabled: isDedupeEnabled(),
    connected: Boolean(collection),
    db: getDbName(),
    collection: getCollectionName(),
  };
}

export async function closeMongo() {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  collection = null;
}
