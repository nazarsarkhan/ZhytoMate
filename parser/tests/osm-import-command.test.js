import assert from 'node:assert/strict';
import test from 'node:test';
import { importPlaces } from '../scripts/import-osm-places.js';

test('imports normalized places with bulk upsert and preserves existing data on fetch failure', async () => {
  const writes = [];
  const collection = {
    async bulkWrite(operations, options) { writes.push({ operations, options }); return { ok: 1 }; },
  };
  const result = await importPlaces({
    fetchPlaces: async () => [{ sourceId: 'osm:node:1', name: 'Кафе', latitude: 50.2, longitude: 28.6 }],
    collection,
    bbox: '50.20,28.60,50.30,28.75',
  });

  assert.equal(result.imported, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].operations[0].updateOne.filter.sourceId, 'osm:node:1');
  assert.equal(writes[0].options.ordered, false);
});

test('does not write when Overpass fetch fails', async () => {
  let writes = 0;
  await assert.rejects(
    importPlaces({ bbox: '50.20,28.60,50.30,28.75', fetchPlaces: async () => { throw new Error('offline'); }, collection: { bulkWrite: async () => { writes += 1; } } }),
    /offline/,
  );
  assert.equal(writes, 0);
});
