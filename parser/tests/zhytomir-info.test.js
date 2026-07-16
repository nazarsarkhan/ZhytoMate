import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublishedAt } from '../plugins/web/zhytomir-info.js';

test('parses Ukrainian month names from zhitomir.info article dates', () => {
  assert.equal(
    parsePublishedAt('15 липня 2026, 14:47'),
    '2026-07-15T11:47:00.000Z',
  );
});
