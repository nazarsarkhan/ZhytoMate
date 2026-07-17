import 'dotenv/config';
import { closeMongo, initMongo } from '../core/storage/mongo.js';
import { waitForQueueIdle } from '../core/delivery/sender.js';
import { runWebPlugin } from '../core/scheduler/scheduler.js';

/**
 * Run one web plugin once, then wait until its normalized items are delivered.
 * The long-running service in index.js still owns scheduled runs for all sources.
 */
export async function runWebSource(plugin) {
  await initMongo();

  try {
    const items = await runWebPlugin(plugin, { throwOnError: true });
    await waitForQueueIdle();
    console.log(`Finished one-shot web source: ${plugin.id} (${items.length} item(s))`);
    return items;
  } finally {
    await closeMongo();
  }
}
