import { config } from "../config/index.js";
import { ApiError } from "../shared/ApiError.js";

// Guards service-to-service endpoints (e.g. the parser's news ingest) with the shared
// INTERNAL_TOKEN. This is the inbound counterpart to the outbound x-internal-token that
// shared/mlClient.js already sends to ml-service. Fails closed: if INTERNAL_TOKEN is unset on this
// server, no request can pass.
export function requireInternalToken(req, _res, next) {
  const token = req.get("x-internal-token");
  if (!config.internalToken || token !== config.internalToken) {
    return next(ApiError.unauthorized("Invalid internal token"));
  }
  return next();
}

export default requireInternalToken;
