import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldKeepItem } from '../plugins/web/zt-rada.js';

test('keeps evergreen zt-rada sections outside the news backfill window', () => {
  assert.equal(
    shouldKeepItem(
      {
        sourceKind: 'section',
        body: 'Довідкова інформація міської ради з актуальними правилами та послугами.',
        publishedAt: '2025-01-01T00:00:00.000Z',
      },
      new Date('2026-07-15T00:00:00.000Z'),
    ),
    true,
  );
});
