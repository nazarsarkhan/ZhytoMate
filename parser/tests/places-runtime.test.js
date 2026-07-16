import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlacesSync } from '../core/places/places-runtime.js';

test('places sync reports successful import and last run time', async () => {
  const indexes = [];
  const sync = createPlacesSync({
    bbox: '50.20,28.60,50.30,28.75',
    fetchPlaces: async () => [{ sourceId: 'osm:node:1' }],
    collection: { async createIndex(value, options) { indexes.push({ value, options }); }, async bulkWrite() {} },
  });
  const result = await sync.run();

  assert.equal(result.imported, 1);
  assert.equal(sync.getStatus().lastRunStatus, 'ok');
  assert.ok(sync.getStatus().lastRunAt);
  assert.equal(indexes.length, 2);
});
