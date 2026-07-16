import { User } from "../user/user.model.js";
import { OutageAddressCache, OutageScheduleCache } from "./outage.model.js";

function normalizePart(value) {
  return String(value || "")
    .toLocaleLowerCase("uk-UA")
    .replace(/[’']/g, "'")
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAddressKey(address = {}) {
  return [address.city, address.street, address.building].map(normalizePart).join("|");
}

export function toAddressSnapshot(address = {}) {
  return {
    addressKey: buildAddressKey(address),
    street: address.street || "",
    building: address.building || "",
    neighborhood: address.neighborhood || "",
    district: address.district || "",
    city: address.city || "",
    formatted: address.formatted || "",
  };
}

export async function findActiveUserAddresses() {
  const users = await User.find({
    "address.verified": true,
    "address.street": { $nin: [null, ""] },
    "address.building": { $nin: [null, ""] },
  })
    .select({ address: 1 })
    .lean();

  const unique = new Map();
  for (const user of users) {
    const snapshot = toAddressSnapshot(user.address);
    if (snapshot.addressKey !== "||") unique.set(snapshot.addressKey, snapshot);
  }
  return [...unique.values()];
}

export async function getAddressCache(addressKey) {
  return OutageAddressCache.findOne({ addressKey }).lean();
}

export async function touchAddressCache(address, now = new Date()) {
  const snapshot = toAddressSnapshot(address);
  await OutageAddressCache.updateOne(
    { addressKey: snapshot.addressKey },
    { $set: { ...snapshot, lastUsedAt: now } },
    { upsert: true },
  );
  return snapshot;
}

export async function upsertAddressSource({ address, sourcePageId, queueNumber, subqueue, fetchedAt, nextRefreshAt, lastError = "" }) {
  const snapshot = toAddressSnapshot(address);
  await OutageAddressCache.updateOne(
    { addressKey: snapshot.addressKey },
    {
      $set: {
        ...snapshot,
        sourcePageId,
        queueNumber,
        subqueue,
        lastFetchedAt: fetchedAt,
        nextRefreshAt,
        lastError,
      },
      $setOnInsert: { lastUsedAt: fetchedAt },
    },
    { upsert: true },
  );
}

export async function removeUnusedAddressCaches(activeKeys, cutoff) {
  const filter = { lastUsedAt: { $lt: cutoff } };
  if (activeKeys.length) filter.addressKey = { $nin: activeKeys };
  return OutageAddressCache.deleteMany(filter);
}

export async function findSchedule({ queueNumber, subqueue, date }) {
  return OutageScheduleCache.findOne({ queueNumber, subqueue, date }).lean();
}

export async function upsertSchedules({ date, schedules, fetchedAt, expiresAt, sourceUpdatedAt, sourceHasActiveCommand }) {
  if (!date || !schedules.length) return;

  await OutageScheduleCache.bulkWrite(
    schedules.map((schedule) => ({
      updateOne: {
        filter: {
          scheduleKey: `${date}|${schedule.queueNumber}.${schedule.subqueue}`,
        },
        update: {
          $set: {
            date,
            queueNumber: schedule.queueNumber,
            subqueue: schedule.subqueue,
            slots: schedule.slots,
            sourceUpdatedAt,
            sourceHasActiveCommand,
            fetchedAt,
            expiresAt,
          },
        },
        upsert: true,
      },
    })),
  );
}

export async function removeExpiredSchedules(now = new Date()) {
  return OutageScheduleCache.deleteMany({ expiresAt: { $lte: now } });
}

