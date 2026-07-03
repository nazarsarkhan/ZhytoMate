import crypto from 'node:crypto';
import dns from 'node:dns';
import { MongoClient } from 'mongodb';

const defaultMongoUri = 'mongodb://127.0.0.1:27017';
const defaultDbName = 'future_in_action_scraper';
const defaultScrapedCollectionName = 'scraped_items';
const defaultNewsCollectionName = 'news_items';
const defaultReservationTtlMinutes = 30;
const defaultDnsServers = ['1.1.1.1', '8.8.8.8'];

let client;
let scrapedCollection;
let newsCollection;
let dnsConfigured = false;

function getMongoUri() {
  return process.env.MONGO_URI || defaultMongoUri;
}

function getDbName() {
  if (process.env.MONGO_DB) {
    return process.env.MONGO_DB;
  }

  try {
    const dbName = new URL(getMongoUri()).pathname.replace(/^\/+/, '');
    return dbName || defaultDbName;
  } catch {
    return defaultDbName;
  }
}

function getScrapedCollectionName() {
  return defaultScrapedCollectionName;
}

function getNewsCollectionName() {
  return defaultNewsCollectionName;
}

function isMongoStorageEnabled() {
  return true;
}

function getReservationTtlMs() {
  const minutes = Number(process.env.SCRAPER_DEDUPE_RESERVATION_TTL_MINUTES);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0
    ? minutes
    : defaultReservationTtlMinutes;

  return safeMinutes * 60 * 1000;
}

function getDnsServers() {
  const value = process.env.DNS_SERVERS;

  if (!value) {
    return defaultDnsServers;
  }

  return value
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
}

function configureDns() {
  if (dnsConfigured) {
    return;
  }

  const servers = getDnsServers();

  if (servers.length === 0) {
    dnsConfigured = true;
    return;
  }

  dns.setServers(servers);
  dns.setDefaultResultOrder('ipv4first');
  dnsConfigured = true;
  console.log(`DNS servers configured for Mongo SRV lookup: ${servers.join(', ')}`);
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
  if (scrapedCollection && newsCollection) {
    return {
      scrapedItems: scrapedCollection,
      newsItems: newsCollection,
    };
  }

  configureDns();
  client = new MongoClient(getMongoUri());
  await client.connect();

  const db = client.db(getDbName());
  scrapedCollection = db.collection(getScrapedCollectionName());
  newsCollection = db.collection(getNewsCollectionName());

  await scrapedCollection.createIndex({ dedupeKey: 1 }, { unique: true });
  await scrapedCollection.createIndex({ source: 1, type: 1, publishedAt: -1 });
  await scrapedCollection.createIndex({ status: 1, reservedAt: 1 });
  await newsCollection.createIndex({ external_id: 1 }, { unique: true });
  await newsCollection.createIndex({ publishedDate: -1, source: 1 });
  await newsCollection.createIndex({ category: 1, publishedDate: -1 });
  await newsCollection.createIndex({ expires_at: 1 });

  console.log(`Mongo scraped registry ready: ${getDbName()}.${getScrapedCollectionName()}`);
  console.log(`Mongo news storage ready: ${getDbName()}.${getNewsCollectionName()}`);

  return {
    scrapedItems: scrapedCollection,
    newsItems: newsCollection,
  };
}

async function getScrapedCollection() {
  const collections = await initMongo();
  return collections.scrapedItems;
}

async function getNewsCollection() {
  const collections = await initMongo();
  return collections.newsItems;
}

export async function reserveScrapedItem(item) {
  if (!isMongoStorageEnabled()) {
    return true;
  }

  const items = await getScrapedCollection();
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
  if (!isMongoStorageEnabled()) {
    return;
  }

  const items = await getScrapedCollection();
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

export async function markScrapedItemSkipped(item, reason) {
  if (!isMongoStorageEnabled()) {
    return;
  }

  const items = await getScrapedCollection();
  await items.updateOne(
    { dedupeKey: getDedupeKey(item) },
    {
      $set: {
        status: 'skipped',
        skippedAt: new Date(),
        skipReason: reason || null,
      },
    },
  );
}

export async function releaseScrapedItemReservation(item) {
  if (!isMongoStorageEnabled()) {
    return;
  }

  const items = await getScrapedCollection();
  await items.deleteOne({
    dedupeKey: getDedupeKey(item),
    status: 'reserved',
  });
}

function getPublishedDate(newsItem) {
  const date = new Date(newsItem.published_at || Date.now());

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export async function saveNewsItem(newsItem, sourceItem) {
  if (!isMongoStorageEnabled()) {
    return;
  }

  const items = await getNewsCollection();
  const now = new Date();
  await items.updateOne(
    { external_id: newsItem.external_id },
    {
      $set: {
        ...newsItem,
        publishedDate: getPublishedDate(newsItem),
        sourceItemId: sourceItem.id,
        sourceUrl: sourceItem.url || null,
        sourceType: sourceItem.type,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export function getMongoStatus() {
  return {
    storageEnabled: isMongoStorageEnabled(),
    connected: Boolean(scrapedCollection && newsCollection),
    db: getDbName(),
    scrapedCollection: getScrapedCollectionName(),
    newsCollection: getNewsCollectionName(),
  };
}

export async function closeMongo() {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  scrapedCollection = null;
  newsCollection = null;
}
