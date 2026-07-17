import { normalizeOsmElements } from './osm-normalizer.js';

const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const FALLBACK_ENDPOINT = 'https://overpass.kumi.systems/api/interpreter';

export function buildPlacesQuery(bbox) {
  if (typeof bbox !== 'string' || !/^\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(bbox)) {
    throw new Error('PLACES_BBOX must be south,west,north,east');
  }
  // Query only useful named POIs inside the Zhytomyr administrative area. A blanket name query
  // returns villages, landmarks without practical details, unrelated buildings and technical
  // objects from the surrounding oblast.
  // 3602692156 is the Overpass area for the OSM relation of Zhytomyr city. Using the relation
  // keeps nearby villages out even though the scheduler still accepts the legacy bbox setting.
  const area = 'area(3602692156)->.zhytomyr;';
  const tagClauses = [
    'nwr["name"]["amenity"~"cafe|restaurant|fast_food|bar|pub|food_court|ice_cream|biergarten|pharmacy|clinic|hospital|dentist|doctors|veterinary|optician|bank|post_office|fuel|car_repair|beauty|hairdresser|laundry|dry_cleaning|travel_agency|lawyer|school|college|university|kindergarten|townhall|courthouse|police|fire_station|government|embassy|theatre|cinema|museum|library|arts_centre|community_centre"]',
    'nwr["name"]["shop"~"supermarket|convenience|bakery|marketplace|mall|department_store|clothes|kiosk|beverages|drinks|general|water"]',
    'nwr["name"]["tourism"~"museum|gallery|attraction|zoo|viewpoint"]',
    'nwr["name"]["historic"~"monument|memorial"]',
    'nwr["name"]["leisure"~"park|playground"]',
    'nwr["name"]["public_transport"~"platform|station|stop_position|tram_stop|taxi"]',
    'nwr["name"]["highway"="bus_stop"]',
  ].map((clause) => `${clause}(area.zhytomyr);`).join('');
  return `[out:json][timeout:90];${area}(${tagClauses});out center tags;`;
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
