import { getUserById } from "../user/user.service.js";
import { config } from "../../config/index.js";
import { findSchedule, getAddressCache, touchAddressCache } from "./outage.cache.js";
import { refreshAddress } from "./outage.sync.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function kyivNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  return {
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function buildNow(slots, hour, minute) {
  if (!slots?.length) return null;
  const slotIndex = Math.min(slots.length - 1, Math.floor((hour * 60 + minute) / 30));
  const current = slots[slotIndex];
  let changeIndex = slotIndex + 1;

  while (changeIndex < slots.length && slots[changeIndex].status === current.status) changeIndex += 1;

  const next = slots[changeIndex] || current;
  const nextChangeInMinutes = Math.max(1, changeIndex * 30 - (hour * 60 + minute));

  return {
    status: current.status,
    nextStatus: next.status,
    nextChangeInMinutes,
    until: next === current ? "24:00" : next.from,
  };
}

function buildSchedule({ address, cache, source, now, stale = false }) {
  return {
    queue: `${source.queueNumber}.${source.subqueue}`,
    queueNumber: source.queueNumber,
    subqueue: source.subqueue,
    resolvedFrom: "address",
    addressLabel: address.formatted || [address.street, address.building].filter(Boolean).join(", "),
    updatedAt: source.fetchedAt?.toISOString?.() || new Date(source.fetchedAt).toISOString(),
    sourceUpdatedAt: source.sourceUpdatedAt || "",
    source: "ztoe",
    stale,
    now: buildNow(source.slots, now.hour, now.minute),
    days: [{ date: source.date, label: source.date === now.dateStr ? "today" : "source", slots: source.slots }],
    cacheExpiresAt: cache?.expiresAt || null,
  };
}

async function loadCurrentSchedule({ address, queueNumber, subqueue }) {
  const now = kyivNow();
  const schedule = await findSchedule({ queueNumber, subqueue, date: now.dateStr });
  return { now, schedule };
}

export async function getOutageSchedule({ userId, queueOverride, subqueueOverride }) {
  const now = kyivNow();

  if (queueOverride !== null && queueOverride !== undefined) {
    const queueNumber = clamp(queueOverride, 1, 6);
    const subqueue = clamp(subqueueOverride || 1, 1, 2);
    const source = await findSchedule({ queueNumber, subqueue, date: now.dateStr });
    if (!source) return { needsAddress: false, unavailable: true, schedule: null };
    return {
      needsAddress: false,
      unavailable: false,
      schedule: buildSchedule({ address: {}, cache: null, source, now }),
    };
  }

  const user = await getUserById(userId);
  const address = user?.address;
  if (!address?.verified || !address.street || !address.building) {
    return { needsAddress: true, unavailable: false, schedule: null };
  }

  const snapshot = await touchAddressCache(address);
  let cache = await getAddressCache(snapshot.addressKey);
  let source = cache?.queueNumber && cache?.subqueue
    ? (await loadCurrentSchedule({ address, queueNumber: cache.queueNumber, subqueue: cache.subqueue })).schedule
    : null;
  let stale = false;

  const refreshDue = !cache?.queueNumber
    || !cache?.nextRefreshAt
    || new Date(cache.nextRefreshAt) <= new Date()
    || !source;

  if (refreshDue) {
    try {
      await refreshAddress(address);
      cache = await getAddressCache(snapshot.addressKey);
      source = cache?.queueNumber && cache?.subqueue
        ? (await loadCurrentSchedule({ address, queueNumber: cache.queueNumber, subqueue: cache.subqueue })).schedule
        : null;
    } catch (error) {
      stale = Boolean(source);
      console.warn("[outage] live refresh failed:", error.message);
    }
  }

  if (!source) {
    return {
      needsAddress: false,
      unavailable: true,
      reason: "ztoe_unavailable",
      schedule: null,
    };
  }

  return {
    needsAddress: false,
    unavailable: false,
    schedule: buildSchedule({ address, cache, source, now, stale }),
  };
}

export default { getOutageSchedule };

