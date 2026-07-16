import { normalizeOsmElements } from './osm-normalizer.js';

const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const FALLBACK_ENDPOINT = 'https://overpass.kumi.systems/api/interpreter';

export function buildPlacesQuery(bbox) {
  if (typeof bbox !== 'string' || !/^\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(bbox)) {
    throw new Error('PLACES_BBOX must be south,west,north,east');
  }
  // Restrict the catalog to named POI/transport tags. A blanket name query returns thousands of
  // unrelated buildings/addresses, times out on public Overpass, and pollutes the `other` bucket.
  const tagClauses = ['amenity', 'shop', 'tourism', 'public_transport', 'leisure']
    .map((tag) => `nwr["name"]["${tag}"](${bbox});`)
    .join('');
  return `[out:json][timeout:90];(${tagClauses}nwr["name"]["highway"="bus_stop"](${bbox}););out center tags;`;
}

export async function fetchOsmPlaces({
  bbox,
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = globalThis.fetch,
  userAgent = 'ZhytoMate-places-import/1.0 (contact: admin@example.com)',
}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch implementation is required');
  const endpoints = [...new Set([endpoint, FALLBACK_ENDPOINT])];
  let lastStatus = null;
  for (const target of endpoints) {
    try {
      const response = await fetchImpl(target, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': userAgent },
        body: `data=${encodeURIComponent(buildPlacesQuery(bbox))}`,
      });
      if (response.ok) {
        const payload = await response.json();
        return normalizeOsmElements(payload.elements);
      }
      lastStatus = response.status;
    } catch (error) {
      // Public Overpass instances commonly fail with a network/header timeout. Try the
      // independent fallback before surfacing the failure; the sync layer preserves the catalog.
      lastStatus = error?.message || 'network-error';
    }
  }
  throw new Error(`Overpass request failed with HTTP ${lastStatus}`);
}

export default { buildPlacesQuery, fetchOsmPlaces };
