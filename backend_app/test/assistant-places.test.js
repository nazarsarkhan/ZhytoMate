import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPlaceQuery, formatPlaceAnswer } from '../src/features/places/places-assistant.js';

test('detects commercial place queries in Russian and Ukrainian', () => {
  assert.deepEqual(detectPlaceQuery('Куда пойти поесть в Житомире?'), { category: 'food' });
  assert.deepEqual(detectPlaceQuery('де найближчий супермаркет'), { category: 'shopping' });
  assert.deepEqual(detectPlaceQuery('какие музеи есть в центре'), { category: 'culture' });
  assert.deepEqual(detectPlaceQuery('где остановка троллейбуса'), { category: 'transport' });
});

test('leaves official civic-service questions to the RAG', () => {
  assert.equal(detectPlaceQuery('где сделать паспорт в Житомире'), null);
  assert.equal(detectPlaceQuery('а где суд?'), null);
  assert.equal(detectPlaceQuery('где находится ЦНАП'), null);
});

test('formats only catalog hits and includes OSM attribution', () => {
  const answer = formatPlaceAnswer([
    { name: 'Кава', address: 'Михайлівська, 3', sourceUrl: 'https://www.openstreetmap.org/node/1' },
  ]);
  assert.match(answer, /Кава/);
  assert.match(answer, /OpenStreetMap/);
  assert.equal(formatPlaceAnswer([]), null);
});
