import assert from 'node:assert/strict';
import test from 'node:test';
import { startPlacesScheduler } from '../core/places/places-scheduler.js';

test('starts an OSM scheduler with no overlap and runs once immediately', async () => {
  const scheduled = [];
  let runs = 0;
  const cronImpl = {
    validate: (value) => value === '0 3 * * *',
    schedule: (expression, task, options) => { scheduled.push({ expression, task, options }); return { stop() {} }; },
  };

  const task = startPlacesScheduler({ schedule: '0 3 * * *', cronImpl, run: async () => { runs += 1; } });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].options.noOverlap, true);
  assert.equal(runs, 1);
  assert.equal(typeof task.stop, 'function');
});
