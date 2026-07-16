import { ApiError } from "../../shared/ApiError.js";

const buckets = new Map();

export function authRateLimit({ windowMs, max }) {
  return (req, _res, next) => {
    const key = `${req.ip || "unknown"}:${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    if (bucket.count > max) return next(ApiError.tooManyRequests("Спробуйте ще раз трохи пізніше."));
    return next();
  };
}

export default authRateLimit;
