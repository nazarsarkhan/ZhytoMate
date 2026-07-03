// TTL bounds mirror ml-service's IngestRequest contract (ttl_days: 1..365). Keep in sync with
// ml-service/app/schemas/ingest.py — a value outside this range is rejected there with HTTP 422.
export const MIN_TTL_DAYS = 1;
export const MAX_TTL_DAYS = 365;

export function clampTtlDays(value) {
  const days = Math.ceil(Number(value));

  if (!Number.isFinite(days)) {
    return MIN_TTL_DAYS;
  }

  return Math.min(MAX_TTL_DAYS, Math.max(MIN_TTL_DAYS, days));
}
