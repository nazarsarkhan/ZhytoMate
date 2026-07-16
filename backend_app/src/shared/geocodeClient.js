import { config } from "../config/index.js";

// Verifies and normalizes a citizen address via Nominatim (OpenStreetMap geocoder).
//
// Lookup failures resolve to { verified: false, normalized: null } rather than throwing. The user
// service decides whether a failed lookup may be persisted. Nominatim requires an identifying
// User-Agent header and rate-limits to ~1 req/sec (see config comment).
const GEOCODE_TIMEOUT_MS = 7_000;

function buildQuery({ street, building, neighborhood, district, city }) {
  // "street building, district, city, default-city" — empty parts dropped. The default city is
  // appended so a bare "street, building" still resolves within the target city (e.g. Житомир).
  const line1 = [street, building].filter(Boolean).join(" ").trim();
  const parts = [line1, neighborhood, district, city, config.addressDefaultCity]
    .map((part) => (part || "").trim())
    .filter(Boolean);
  // De-duplicate a repeated city (e.g. user already typed the default city).
  return Array.from(new Set(parts)).join(", ");
}

function normalizeFromNominatim(result) {
  const a = result.address || {};
  const city = a.city || a.town || a.village || a.municipality || "";
  // Keep only the broad OSM suburb/microdistrict. Smaller neighbourhood/quarter values often
  // produce internal local names that make the address unnecessarily long.
  const neighborhood = a.suburb || a.residential || "";
  return {
    street: a.road || "",
    building: a.house_number || "",
    neighborhood,
    district: a.city_district || a.district || a.borough || "",
    city,
  };
}

export function formatCompactAddress(address = {}) {
  const streetAndBuilding = [address.building, address.street]
    .filter(Boolean)
    .join(", ");
  return [streetAndBuilding, address.neighborhood, address.district, address.city]
    .filter(Boolean)
    .join(", ");
}

function buildSuggestionsQueries(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const defaultCity = config.addressDefaultCity.trim();
  const rawQuery = normalizedQuery.toLocaleLowerCase().includes(defaultCity.toLocaleLowerCase())
    ? normalizedQuery
    : `${normalizedQuery}, ${defaultCity}`;
  const parts = rawQuery.split(",").map((part) => part.trim()).filter(Boolean);
  const streetIndex = parts.findIndex((part) => /^(вулиця|вул\.?|провулок|пров\.?|проспект|просп\.?|бульвар|бул\.?|площа|пл\.?)/i.test(part));
  const buildingMatch = parts
    .slice(0, streetIndex >= 0 ? streetIndex : 1)
    .join(" ")
    .match(/\d+[А-Яа-яA-Za-z]?(?:\/\d+)?/);
  const streetPart = streetIndex >= 0 ? parts[streetIndex] : "";
  const cityPart = parts.find((part) => part.toLocaleLowerCase().includes(defaultCity.toLocaleLowerCase())) || defaultCity;
  const compactQuery = streetPart && buildingMatch
    ? `${streetPart} ${buildingMatch[0]} ${cityPart}`
    : "";

  return [...new Set([compactQuery, rawQuery].filter(Boolean))];
}

export async function searchAddresses(query) {
  const queries = buildSuggestionsQueries(query);
  for (const searchQuery of queries) {
    const suggestions = await searchAddressQuery(searchQuery);
    if (suggestions.length) return suggestions;
  }
  return [];
}

async function searchAddressQuery(searchQuery) {
  const url = new URL("/search", config.nominatimBaseUrl);
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("countrycodes", "ua");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": config.nominatimUserAgent,
        "Accept-Language": "uk,en",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const results = await response.json();
    if (!Array.isArray(results)) return [];

    return results
      .map((result) => {
        const normalized = normalizeFromNominatim(result);
        return {
          id: `${result.osm_type || "place"}:${result.osm_id || result.place_id || result.display_name}`,
          ...normalized,
          verified: true,
          formatted: formatCompactAddress(normalized) || result.display_name || "",
          lat: result.lat ? Number(result.lat) : null,
          lon: result.lon ? Number(result.lon) : null,
        };
      })
      .filter((result) => result.formatted && result.street && result.building && result.lat !== null && result.lon !== null);
  } catch (err) {
    console.warn("[geocode] address suggestions skipped:", err.message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// Address selection and address saving deliberately use the same backend search path. This keeps
// the save endpoint independent from the frontend's compact display string and handles OSM house
// numbers such as "14, корпус, 1, 14, корпус, 2" correctly.
export async function resolveAddressSelection({ query, suggestionId } = {}) {
  const suggestions = await searchAddresses(query || "");
  const selected = suggestionId
    ? suggestions.find((suggestion) => suggestion.id === suggestionId) || suggestions[0]
    : suggestions[0];

  if (!selected) return { verified: false, normalized: null, lat: null, lon: null, displayName: "" };

  return {
    verified: true,
    normalized: selected,
    lat: selected.lat,
    lon: selected.lon,
    displayName: selected.formatted,
  };
}

export async function reverseAddress({ lat, lon }) {
  const url = new URL("/reverse", config.nominatimBaseUrl);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": config.nominatimUserAgent,
        "Accept-Language": "uk,en",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const result = await response.json();
    const normalized = normalizeFromNominatim(result);
    if (!result.display_name || !normalized.street) return null;

    return {
      id: `${result.osm_type || "place"}:${result.osm_id || result.place_id || result.display_name}`,
      ...normalized,
      verified: true,
      formatted: formatCompactAddress(normalized) || result.display_name,
      lat: result.lat ? Number(result.lat) : lat,
      lon: result.lon ? Number(result.lon) : lon,
    };
  } catch (err) {
    console.warn("[geocode] reverse address lookup skipped:", err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

    const normalized = normalizeFromNominatim(match);
    return {
      verified: true,
      normalized,
      lat: match.lat ? Number(match.lat) : null,
      lon: match.lon ? Number(match.lon) : null,
      displayName: formatCompactAddress(normalized) || match.display_name || "",
    };
  } catch (err) {
    console.warn("[geocode] address verification skipped:", err.message);
    return { verified: false, normalized: null };
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  verifyAddress,
  resolveAddressSelection,
  searchAddresses,
  reverseAddress,
  formatCompactAddress,
};
