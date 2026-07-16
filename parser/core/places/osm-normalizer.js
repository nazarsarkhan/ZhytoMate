const CATEGORY_RULES = [
  ['food', new Set(['cafe', 'restaurant', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream', 'biergarten', 'food'])],
  ['shopping', new Set(['supermarket', 'convenience', 'bakery', 'marketplace', 'mall', 'department_store', 'clothes', 'kiosk', 'beverages', 'drinks', 'general', 'water'])],
  ['health', new Set(['pharmacy', 'clinic', 'hospital', 'dentist', 'doctors', 'veterinary', 'optician'])],
  ['services', new Set(['bank', 'post_office', 'fuel', 'car_repair', 'beauty', 'hairdresser', 'laundry', 'dry_cleaning', 'travel_agency', 'lawyer'])],
  ['education', new Set(['school', 'college', 'university', 'kindergarten'])],
  ['government', new Set(['townhall', 'courthouse', 'police', 'fire_station', 'government', 'embassy'])],
  ['culture', new Set(['theatre', 'cinema', 'museum', 'library', 'arts_centre', 'community_centre', 'monument'])],
  ['transport', new Set(['bus_station', 'platform', 'station', 'stop_position', 'tram_stop', 'taxi'])],
];

function firstTag(tags, keys) {
  return keys.map((key) => tags[key]).find((value) => typeof value === 'string' && value.trim()) ?? null;
}

function getSubtype(tags) {
  return firstTag(tags, ['amenity', 'shop', 'tourism', 'public_transport', 'highway']) ?? 'place';
}

function getCategory(tags) {
  const subtype = getSubtype(tags);
  return CATEGORY_RULES.find(([, values]) => values.has(subtype))?.[0] ?? 'other';
}

function formatAddress(tags) {
  const street = firstTag(tags, ['addr:street', 'addr:place']);
  const house = firstTag(tags, ['addr:housenumber']);
  const locality = firstTag(tags, ['addr:suburb', 'addr:district']);
  return [street && house ? `${street}, ${house}` : street || house, locality]
    .filter(Boolean)
    .join(', ') || null;
}

function getCoordinates(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }
  return null;
}

function sourceUrl(element) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

export function normalizeOsmElement(element) {
  if (!element || !['node', 'way', 'relation'].includes(element.type) || !Number.isInteger(element.id)) {
    return null;
  }
  const tags = element.tags && typeof element.tags === 'object' ? element.tags : {};
  const name = firstTag(tags, ['name', 'name:uk', 'name:ru', 'brand']);
  const coordinates = getCoordinates(element);
  if (!name || !coordinates) return null;

  return {
    sourceId: `osm:${element.type}:${element.id}`,
    name,
    category: getCategory(tags),
    subtype: getSubtype(tags),
    address: formatAddress(tags),
    ...coordinates,
    phone: firstTag(tags, ['phone', 'contact:phone']),
    openingHours: firstTag(tags, ['opening_hours']),
    sourceUrl: sourceUrl(element),
    source: 'openstreetmap',
  };
}

export function normalizeOsmElements(elements) {
  const byIdentity = new Map();
  for (const element of elements ?? []) {
    const place = normalizeOsmElement(element);
    if (!place) continue;
    const identity = `${place.name.toLocaleLowerCase()}|${place.latitude.toFixed(5)}|${place.longitude.toFixed(5)}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, place);
  }
  return [...byIdentity.values()];
}

export default { normalizeOsmElement, normalizeOsmElements };
