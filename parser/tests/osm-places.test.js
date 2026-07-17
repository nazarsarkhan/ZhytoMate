import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOsmElement, normalizeOsmElements } from '../core/places/osm-normalizer.js';
import { buildPlacesQuery, fetchOsmPlaces } from '../core/places/overpass-client.js';

test('normalizes a named OSM node into a POI', () => {
  const place = normalizeOsmElement({
    type: 'node',
    id: 42,
    lat: 50.25,
    lon: 28.66,
    tags: { amenity: 'cafe', name: 'Кава', 'addr:street': 'Михайлівська', 'addr:housenumber': '3' },
  });

  assert.deepEqual(place, {
    sourceId: 'osm:node:42',
    name: 'Кава',
    category: 'food',
    subtype: 'cafe',
    address: 'Михайлівська, 3',
    latitude: 50.25,
    longitude: 28.66,
    phone: null,
    openingHours: null,
    sourceUrl: 'https://www.openstreetmap.org/node/42',
    source: 'openstreetmap',
  });
});

test('maps common city catalog subtypes into user-facing categories', () => {
  const places = normalizeOsmElements([
    { type: 'node', id: 20, lat: 50.2, lon: 28.6, tags: { shop: 'beverages', name: 'Water shop' } },
    { type: 'node', id: 21, lat: 50.2, lon: 28.6, tags: { amenity: 'hairdresser', name: 'Salon' } },
    { type: 'node', id: 22, lat: 50.2, lon: 28.6, tags: { public_transport: 'platform', name: 'Platform' } },
  ]);
  assert.deepEqual(places.map((place) => place.category), ['shopping', 'services', 'transport']);
});

test('classifies highway bus stops as transport places', () => {
  const place = normalizeOsmElement({
    type: 'node',
    id: 23,
    lat: 50.2,
    lon: 28.6,
    tags: { highway: 'bus_stop', name: 'Зупинка Центральна' },
  });

  assert.equal(place.category, 'transport');
});

test('uses center coordinates for ways and deduplicates unnamed/duplicate elements', () => {
  const places = normalizeOsmElements([
    { type: 'way', id: 7, center: { lat: 50.2, lon: 28.6 }, tags: { shop: 'supermarket', name: 'Market' } },
    { type: 'node', id: 8, lat: 50.2, lon: 28.6, tags: { shop: 'supermarket', name: 'Market' } },
    { type: 'node', id: 9, lat: 50.2, lon: 28.6, tags: { shop: 'supermarket' } },
  ]);

  assert.equal(places.length, 1);
  assert.equal(places[0].subtype, 'supermarket');
  assert.equal(places[0].latitude, 50.2);
});

test('builds a bounded JSON Overpass query with a safe timeout', () => {
  const query = buildPlacesQuery('50.20,28.60,50.30,28.75');
  assert.match(query, /^\[out:json\]\[timeout:90\];area\(3602692156\)->\.zhytomyr;\(/);
  assert.match(query, /nwr\["name"\]\["amenity"~/);
  assert.match(query, /nwr\["name"\]\["highway"="bus_stop"\]/);
  assert.match(query, /out center tags;$/);
});

test('fetches and normalizes one Overpass response', async () => {
  const calls = [];
  const places = await fetchOsmPlaces({
    bbox: '50.20,28.60,50.30,28.75',
    endpoint: 'https://overpass.example/api/interpreter',
    fetchImpl: async (_url, options) => {
      calls.push(options);
      return { ok: true, async json() { return { elements: [{ type: 'node', id: 1, lat: 50.2, lon: 28.6, tags: { name: 'Кафе', amenity: 'cafe' } }] }; } };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(places[0].sourceId, 'osm:node:1');
});

test('falls back to the secondary Overpass endpoint after a network failure', async () => {
  const calls = [];
  const places = await fetchOsmPlaces({
    bbox: '50.20,28.60,50.30,28.75',
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) throw new Error('Headers Timeout Error');
      return { ok: true, json: async () => ({ elements: [] }) };
    },
  });
  assert.deepEqual(places, []);
  assert.equal(calls.length, 2);
});
