import crypto from "node:crypto";
import { config } from "../../config/index.js";
import { OutageAddressCache, OutageSyncState } from "./outage.model.js";
import {
  findActiveUserAddresses,
  getAddressCache,
  removeExpiredSchedules,
  removeUnusedAddressCaches,
  touchAddressCache,
  upsertAddressSource,
  upsertSchedules,
} from "./outage.cache.js";
import { fetchZtoePage, SOURCE_PAGE_IDS } from "./provider/ztoe.client.js";
import { findAddressInParsedPage, parseZtoePage } from "./provider/ztoe.parser.js";

const SYNC_KEY = "ztoe";
const addressRefreshPromises = new Map();
let backgroundTimer = null;

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

async function fetchPages(pageIds) {
  const results = [];
  const errors = [];

  // Keep requests sequential. The source is a legacy site and a single sync normally needs only
  // one page per used subqueue; parallel requests would create unnecessary load on ZTOE.
  for (const pageId of pageIds) {
    try {
      const page = await fetchZtoePage(pageId);
      results.push({ ...page, parsed: parseZtoePage(page.html, pageId) });
    } catch (error) {
      errors.push({ pageId, error });
      console.warn(`[outage] ZTOE page ${pageId} skipped:`, error.message);
    }
  }

  return { results, errors };
}

export async function syncAddresses(addresses, { force = false } = {}) {
  if (!addresses.length) {
    await removeExpiredSchedules();
    return { addresses: 0, fetchedPages: 0 };
  }

  const now = new Date();
  const snapshots = await Promise.all(addresses.map((address) => touchAddressCache(address, now)));
  const keys = snapshots.map((snapshot) => snapshot.addressKey);
  const cachedRows = await OutageAddressCache.find({ addressKey: { $in: keys } }).lean();
  const cacheByKey = new Map(cachedRows.map((row) => [row.addressKey, row]));

  const dueAddresses = snapshots.filter((address) => {
    const cached = cacheByKey.get(address.addressKey);
    return force || !cached?.nextRefreshAt || new Date(cached.nextRefreshAt) <= now;
  });

  if (!dueAddresses.length) {
    await removeExpiredSchedules(now);
    return { addresses: snapshots.length, fetchedPages: 0 };
  }

  const unknownAddresses = dueAddresses.filter((address) => !cacheByKey.get(address.addressKey)?.sourcePageId);
  const knownPageIds = dueAddresses
    .map((address) => cacheByKey.get(address.addressKey)?.sourcePageId)
    .filter(Boolean);
  const pageIds = unknownAddresses.length ? SOURCE_PAGE_IDS : unique(knownPageIds);
  const { results, errors } = await fetchPages(pageIds);
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + config.outageScheduleCacheTtlMs);

  if (results.length) {
    const source = results[0].parsed;
    await upsertSchedules({
      date: source.date,
      schedules: source.schedules,
      fetchedAt,
      expiresAt,
      sourceUpdatedAt: source.updatedAt,
      sourceHasActiveCommand: source.hasActiveCommand,
    });
  }

  let updatedAddresses = 0;
  for (const address of dueAddresses) {
    const cached = cacheByKey.get(address.addressKey);
    const candidates = cached?.sourcePageId
      ? results.filter((result) => result.pageId === cached.sourcePageId)
      : results;
    const match = candidates
      .map((result) => ({ result, row: findAddressInParsedPage(result.parsed, address) }))
      .find(({ row }) => row);

    if (match) {
      await upsertAddressSource({
        address,
        sourcePageId: match.result.pageId,
        queueNumber: match.row.queueNumber,
        subqueue: match.row.subqueue,
        fetchedAt,
        nextRefreshAt: new Date(fetchedAt.getTime() + config.outageSyncIntervalMs),
      });
      updatedAddresses += 1;
    } else {
      await OutageAddressCache.updateOne(
        { addressKey: address.addressKey },
        {
          $set: {
            lastFetchedAt: fetchedAt,
            nextRefreshAt: new Date(fetchedAt.getTime() + config.outageSyncIntervalMs),
            lastError: errors.length ? errors.map(({ error }) => error.message).join("; ") : "Address was not found on ZTOE",
          },
        },
      );
    }
  }

  await removeExpiredSchedules(now);
  if (!results.length && errors.length) {
    throw errors[0].error;
  }

  return { addresses: updatedAddresses, fetchedPages: results.length };
}

export async function refreshAddress(address) {
  const addressKey = (await touchAddressCache(address)).addressKey;
  if (addressRefreshPromises.has(addressKey)) return addressRefreshPromises.get(addressKey);

  const promise = syncAddresses([address], { force: true }).finally(() => {
    addressRefreshPromises.delete(addressKey);
  });
  addressRefreshPromises.set(addressKey, promise);
  return promise;
}

async function acquireLock() {
  const now = new Date();
  const token = crypto.randomUUID();
  try {
    const state = await OutageSyncState.findOneAndUpdate(
      {
        key: SYNC_KEY,
        $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }],
      },
      {
        $set: {
          lockToken: token,
          lockUntil: new Date(now.getTime() + Math.max(config.outageRequestTimeoutMs * 2, 60_000)),
          lastStartedAt: now,
          lastError: "",
        },
        $setOnInsert: { key: SYNC_KEY },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return state?.lockToken === token ? token : null;
  } catch (error) {
    // A second app instance can race the first insert of the singleton lock document.
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function releaseLock(token, error = null) {
  await OutageSyncState.updateOne(
    { key: SYNC_KEY, lockToken: token },
    {
      $set: {
        lockUntil: null,
        lastFinishedAt: new Date(),
        ...(error ? { lastError: error.message } : {}),
      },
    },
  );
}

export async function runOutageSync() {
  const token = await acquireLock();
  if (!token) return { skipped: true };

  try {
    const addresses = await findActiveUserAddresses();
    const cutoff = new Date(Date.now() - config.outageAddressCacheTtlMs);
    await removeUnusedAddressCaches(addresses.map((address) => address.addressKey), cutoff);
    const result = await syncAddresses(addresses);
    await releaseLock(token);
    return result;
  } catch (error) {
    await releaseLock(token, error);
    console.error("[outage] sync failed:", error.message);
    return { error: error.message };
  }
}

export function startOutageSync() {
  if (backgroundTimer) return () => clearInterval(backgroundTimer);

  const run = () => runOutageSync().catch((error) => console.error("[outage] worker failed:", error.message));
  const initialRun = setTimeout(run, 1_000);
  backgroundTimer = setInterval(run, config.outageSyncIntervalMs);
  initialRun.unref?.();
  backgroundTimer.unref?.();

  return () => {
    clearTimeout(initialRun);
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  };
}

export async function getCachedAddress(address) {
  return getAddressCache((await touchAddressCache(address)).addressKey);
}

