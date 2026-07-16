import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlaceQuery, detectTransportRouteQuery } from '../src/features/places/places-assistant.js';

test('does not route official civic-service questions to a generic OSM category', () => {
  assert.equal(detectPlaceQuery('Де ЦНАП?'), null);
  assert.equal(detectPlaceQuery('Где суд?'), null);
  assert.equal(detectPlaceQuery('Где сделать паспорт?'), null);
});

test('keeps broad commercial place intents on the OSM catalog', () => {
  assert.deepEqual(detectPlaceQuery('Куда пойти поесть в Житомире?'), { category: 'food' });
  assert.deepEqual(detectPlaceQuery('Где купить воду в центре?'), { category: 'shopping' });
});

test('detects transport questions with and without a route number', () => {
  assert.equal(detectTransportRouteQuery('Який маршрут тролейбуса №15А?'), true);
  assert.equal(detectTransportRouteQuery('Де зупинка тролейбуса?'), true);
  assert.equal(detectTransportRouteQuery('Де подивитися маршрути та тролейбуси?'), true);
});

test('detects origin-destination transport questions without a route number', () => {
  const queries = [
    'Мені треба з Глобала доїхати на Богунію, де подивить розклад транспорту?',
    'Як доїхати з Глобала на Богунію?',
    'Як добратися від вокзалу до центру?',
    'Как доехать с Глобала на Богунью?',
    'расписание транспорта от вокзала до Богуньи',
  ];

  for (const query of queries) {
    assert.equal(detectTransportRouteQuery(query), true, query);
  }
});

test('does not classify unrelated place questions as transport routes', () => {
  assert.equal(detectTransportRouteQuery('Де знайти ресторан у центрі?'), false);
  assert.equal(detectTransportRouteQuery('Куди піти поїсти на Богунії?'), false);
});
