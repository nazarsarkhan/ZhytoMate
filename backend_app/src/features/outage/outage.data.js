// Seed/provider layer for power-outage schedules (ГПВ). There is no public JSON API for
// Житомиробленерго - the official site (ztoe.com.ua) only publishes an HTML lookup and updates
// once a day. So this module OWNS a deterministic, plausible schedule keyed by queue/subqueue
// (черга/підчерга). Everything downstream (service, controller, frontend) speaks this normalized
// shape, so swapping this provider for a real ztoe scraper later touches only this file.

export const OUTAGE_STATUS = { ON: "on", OFF: "off", MAYBE: "maybe" };

// Житомиробленерго splits the region into 6 queues, each further into 2 subqueues.
export const QUEUE_COUNT = 6;
export const SUBQUEUE_COUNT = 2;

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

// ГПВ-style rolling pattern: within every 6-hour cycle a queue is dark for 2h, "maybe" (щойно
// повернулось / можливе повторне відключення) for 1h, and powered for 3h. The phase is offset by
// queue, subqueue and day so 3.1 differs from 3.2 and tomorrow differs from today, while at any
// given hour roughly two of the six queues are off - the way real staggered blackouts look.
export function hourStatus(hour, queueNumber, subqueue, dayOffset) {
  const phase = (hour + (queueNumber - 1) * 2 + (subqueue - 1) + dayOffset * 3) % 6;
  if (phase < 2) return OUTAGE_STATUS.OFF;
  if (phase === 2) return OUTAGE_STATUS.MAYBE;
  return OUTAGE_STATUS.ON;
}

// Full 24h coverage as contiguous slots, merging consecutive equal-status hours. The final slot's
// `to` is "24:00" so the frontend can size a timeline bar without a special end-of-day case.
export function buildDaySlots(queueNumber, subqueue, dayOffset) {
  const merged = [];
  for (let hour = 0; hour < 24; hour++) {
    const status = hourStatus(hour, queueNumber, subqueue, dayOffset);
    const last = merged[merged.length - 1];
    if (last && last.status === status) {
      last.toHour = hour + 1;
    } else {
      merged.push({ fromHour: hour, toHour: hour + 1, status });
    }
  }
  return merged.map((slot) => ({
    from: formatHour(slot.fromHour),
    to: formatHour(slot.toHour),
    status: slot.status,
  }));
}

export default { OUTAGE_STATUS, QUEUE_COUNT, SUBQUEUE_COUNT, hourStatus, buildDaySlots };
