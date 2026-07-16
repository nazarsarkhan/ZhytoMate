import assert from 'node:assert/strict';
import test from 'node:test';
import { placesQuerySchema } from '../src/features/places/places.schema.js';
import { buildPlacesFilter } from '../src/features/places/places.repository.js';

test('validates bounded places query and strips unknown fields', () => {
  const { value, error } = placesQuerySchema.validate({ category: 'food', limit: 10, ignored: true }, { stripUnknown: true });
  assert.ifError(error);
  assert.deepEqual(value, { category: 'food', limit: 10, radius_m: 5000, offset: 0 });
});

test('rejects a catalog page over the configured maximum', () => {
  const { error } = placesQuerySchema.validate({ limit: 101 });
  assert.match(error.message, /less than or equal to 100/);
});

test('builds text and category filters without adding empty values', () => {
  assert.deepEqual(buildPlacesFilter({ q: 'кава', category: 'food' }), {
    category: 'food',
    $text: { $search: 'кава' },
  });
});
