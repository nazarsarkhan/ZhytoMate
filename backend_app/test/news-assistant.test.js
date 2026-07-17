import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLatestNewsQuery, formatLatestNewsAnswer } from '../src/features/news/news-assistant.js';

test('detects latest-news questions', () => {
  assert.equal(detectLatestNewsQuery('Останні новини'), true);
  assert.equal(detectLatestNewsQuery('Последние новости Житомира'), true);
  assert.equal(detectLatestNewsQuery('новости Житомир инфо'), true);
  assert.equal(detectLatestNewsQuery('покажи свежие новости'), true);
  assert.equal(detectLatestNewsQuery('Де ЦНАП?'), false);
});

test('formats indexed news compactly without duplicating source URLs in the message', () => {
  const answer = formatLatestNewsAnswer([{ title: 'Нова подія', summary: 'Нова подія. Нормальний опис події.', sourceUrl: 'https://zt-rada.gov.ua/news/1' }]);
  assert.match(answer, /Нова подія/);
  assert.equal(answer.match(/Нова подія/g)?.length, 1);
  assert.doesNotMatch(answer, /https:\/\/zt-rada.gov.ua/);
  assert.equal(formatLatestNewsAnswer([]), null);
});
