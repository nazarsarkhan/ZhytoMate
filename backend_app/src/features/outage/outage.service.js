import { getUserById } from "../user/user.service.js";
import {
  QUEUE_COUNT,
  SUBQUEUE_COUNT,
  buildDaySlots,
  hourStatus,
} from "./outage.data.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Current wall-clock in Kyiv regardless of the server's own timezone (Docker runs UTC), so the
// "now" status and countdown line up with what the resident actually sees on the wall.
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

function addDays(dateStr, days) {
  // Anchor at noon UTC so a ±1 day shift never lands on a DST boundary and flips the date.
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Address -> queue is genuinely ambiguous and Житомиробленерго exposes no mapping API, so we
// resolve it deterministically from the street+building: the same address always yields the same
// черга/підчерга, spread evenly across the six queues. Empty street => no queue (needs address).
function resolveQueueFromAddress(address) {
  const street = (address?.street || "").trim();
  if (!street) return null;

  const key = `${street}|${(address.building || "").trim()}`.toLowerCase();
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }

  return {
    queueNumber: (hash % QUEUE_COUNT) + 1,
    subqueue: (Math.floor(hash / QUEUE_COUNT) % SUBQUEUE_COUNT) + 1,
  };
}

// Current status plus how long until it next changes. Scans forward hour-by-hour (rolling into the
// next day) so a block that straddles midnight still reports a correct countdown.
function computeNow(queueNumber, subqueue, hour, minute) {
  const current = hourStatus(hour, queueNumber, subqueue, 0);

  let steps = 1;
  while (steps <= 48) {
    const absoluteHour = hour + steps;
    const status = hourStatus(
      absoluteHour % 24,
      queueNumber,
      subqueue,
      Math.floor(absoluteHour / 24),
    );
    if (status !== current) break;
    steps += 1;
  }

  const changeHour = hour + steps;
  const nextChangeInMinutes = changeHour * 60 - (hour * 60 + minute);

  return {
    status: current,
    nextStatus: hourStatus(
      changeHour % 24,
      queueNumber,
      subqueue,
      Math.floor(changeHour / 24),
    ),
    nextChangeInMinutes,
    until: `${String(changeHour % 24).padStart(2, "0")}:00`,
  };
}

function buildScheduleForQueue({ queueNumber, subqueue, resolvedFrom, addressLabel }) {
  const { hour, minute, dateStr } = kyivNow();

  return {
    queue: `${queueNumber}.${subqueue}`,
    queueNumber,
    subqueue,
    resolvedFrom,
    addressLabel,
    updatedAt: new Date().toISOString(),
    now: computeNow(queueNumber, subqueue, hour, minute),
    days: [
      { date: dateStr, label: "today", slots: buildDaySlots(queueNumber, subqueue, 0) },
      { date: addDays(dateStr, 1), label: "tomorrow", slots: buildDaySlots(queueNumber, subqueue, 1) },
    ],
  };
}

export async function getOutageSchedule({ userId, queueOverride, subqueueOverride }) {
  // An explicit ?queue override lets the resident browse any queue (e.g. a relative's address)
  // without touching their saved profile.
  if (queueOverride !== null && queueOverride !== undefined) {
    return {
      needsAddress: false,
      schedule: buildScheduleForQueue({
        queueNumber: clamp(queueOverride, 1, QUEUE_COUNT),
        subqueue: clamp(subqueueOverride || 1, 1, SUBQUEUE_COUNT),
        resolvedFrom: "query",
        addressLabel: "",
      }),
    };
  }

  const user = await getUserById(userId);
  const resolved = resolveQueueFromAddress(user?.address);
  if (!resolved) {
    return { needsAddress: true, schedule: null };
  }

  return {
    needsAddress: false,
    schedule: buildScheduleForQueue({
      queueNumber: resolved.queueNumber,
      subqueue: resolved.subqueue,
      resolvedFrom: "address",
      addressLabel: [user.address.street, user.address.building].filter(Boolean).join(", "),
    }),
  };
}

export default { getOutageSchedule };
