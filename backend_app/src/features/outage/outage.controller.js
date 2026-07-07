import { getOutageSchedule } from "./outage.service.js";

function parseQueueParam(raw) {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function getSchedule(req, res, next) {
  try {
    const result = await getOutageSchedule({
      userId: req.user.id,
      queueOverride: parseQueueParam(req.query.queue),
      subqueueOverride: parseQueueParam(req.query.subqueue),
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default { getSchedule };
