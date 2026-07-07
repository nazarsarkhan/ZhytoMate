import { config } from "../config/index.js";

// Verifies and normalizes a citizen address via Nominatim (OpenStreetMap geocoder).
//
// Best-effort by design: any failure (timeout, network error, non-OK response, no match) resolves
// to { verified: false, normalized: null } rather than throwing, so saving an address never gets
// blocked by geocoder health - mirrors how appeal photo triage degrades gracefully. Nominatim
// requires an identifying User-Agent header and rate-limits to ~1 req/sec (see config comment).
const GEOCODE_TIMEOUT_MS = 7_000;

function buildQuery({ street, building, district, city }) {
  // "street building, district, city, default-city" — empty parts dropped. The default city is
  // appended so a bare "street, building" still resolves within the target city (e.g. Житомир).
  const line1 = [street, building].filter(Boolean).join(" ").trim();
  const parts = [line1, district, city, config.addressDefaultCity]
    .map((part) => (part || "").trim())
    .filter(Boolean);
  // De-duplicate a repeated city (e.g. user already typed the default city).
  return Array.from(new Set(parts)).join(", ");
}

function normalizeFromNominatim(result) {
  const a = result.address || {};
  const city = a.city || a.town || a.village || a.municipality || "";
  return {
    street: a.road || "",
    building: a.house_number || "",
    district: a.city_district || a.suburb || a.district || a.borough || "",
    city,
  };
}

export async function verifyAddress(address) {
  const query = buildQuery(address);
  if (!query) {
    return { verified: false, normalized: null };
  }

  const url = new URL("/search", config.nominatimBaseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ua");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        // Required by Nominatim's usage policy - requests without a UA may be blocked.
        "User-Agent": config.nominatimUserAgent,
        "Accept-Language": "uk,en",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { verified: false, normalized: null };
    }

    const results = await response.json();
    const match = Array.isArray(results) ? results[0] : null;
    if (!match) {
      return { verified: false, normalized: null };
    }

    return {
      verified: true,
      normalized: normalizeFromNominatim(match),
      lat: match.lat ? Number(match.lat) : null,
      lon: match.lon ? Number(match.lon) : null,
      displayName: match.display_name || "",
    };
  } catch (err) {
    console.warn("[geocode] address verification skipped:", err.message);
    return { verified: false, normalized: null };
  } finally {
    clearTimeout(timeout);
  }
}

export default { verifyAddress };
