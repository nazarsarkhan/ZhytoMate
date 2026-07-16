import { config } from "../../config/index.js";

const cache = {
  value: null,
  expiresAt: 0,
  inFlight: null,
};

export function parseAlertStatus(payload) {
  const state = payload?.states?.["Житомирська область"];
  if (!state || typeof state.alertnow !== "boolean") return null;
  return state.alertnow ? "active" : "none";
}

function unavailable(reason) {
  return {
    available: false,
    status: "unknown",
    region: "Житомир",
    source: "ubilling.net.ua",
    reason,
    updatedAt: null,
  };
}

async function requestStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aerialAlertsRequestTimeoutMs);

  try {
    const response = await fetch(config.aerialAlertsBaseUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ubilling.net.ua returned HTTP ${response.status}`);

    const payload = await response.json();
    const status = parseAlertStatus(payload);
    if (!status) throw new Error("ubilling.net.ua returned an unknown Zhytomyr status");
    const state = payload.states["Житомирська область"];

    return {
      available: true,
      status,
      region: "Житомир",
      source: "ubilling.net.ua",
      reason: null,
      updatedAt: new Date().toISOString(),
      sourceUpdatedAt: state.changed || payload.cachedat || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getZhytomyrAlertStatus({ force = false } = {}) {
  if (!force && cache.value && cache.expiresAt > Date.now()) return cache.value;
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = requestStatus()
    .catch((error) => {
      console.error(`[alerts] ${error.message}`);
      return unavailable("provider_error");
    })
    .then((value) => {
      cache.value = value;
      cache.expiresAt = Date.now() + config.aerialAlertsCacheTtlMs;
      return value;
    })
    .finally(() => {
      cache.inFlight = null;
    });

  return cache.inFlight;
}

export function resetAlertCache() {
  cache.value = null;
  cache.expiresAt = 0;
  cache.inFlight = null;
}
