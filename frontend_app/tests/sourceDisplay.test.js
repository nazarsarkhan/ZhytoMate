import assert from 'node:assert/strict';
import test from 'node:test';
import { getSourceLabel, getSourceUrl, isLinkableSource } from '../src/lib/sourceDisplay.js';

test('only http sources become links', () => {
  assert.equal(isLinkableSource('manual-curated'), false);
  assert.equal(isLinkableSource('https://zt-rada.gov.ua/example'), true);
});

test('supports both RAG source objects and OSM URL strings', () => {
  assert.equal(getSourceUrl('https://www.openstreetmap.org/node/1'), 'https://www.openstreetmap.org/node/1');
  assert.equal(getSourceLabel({ source: 'https://zt-rada.gov.ua/' }), 'https://zt-rada.gov.ua/');
});

test('does not render undefined source values', () => {
  assert.equal(getSourceLabel({}), 'Джерело не вказано');
});
