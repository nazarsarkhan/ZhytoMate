import cron from 'node-cron';
import { normalizeItems } from './normalizer.js';
import { enqueueItems } from './sender.js';

async function runWebPlugin(plugin) {
  try {
    console.log(`Running web plugin: ${plugin.id}`);
    const rawItems = await plugin.fetch();
    const normalizedItems = normalizeItems(rawItems, plugin, 'web');
    enqueueItems(normalizedItems);
  } catch (error) {
    console.error(`Web plugin ${plugin.id} failed:`, error);
  }
}

/**
 * Register every enabled web plugin on its cron schedule.
 *
 * The plugin contract is:
 * {
 *   id: string,
 *   schedule: string,
 *   enabled: boolean,
 *   async fetch() => Array<{ url, title, body, publishedAt }>
 * }
 */
export function startScheduler(webPlugins) {
  for (const plugin of webPlugins) {
    if (!cron.validate(plugin.schedule)) {
      console.error(`Skipping ${plugin.id}: invalid cron schedule "${plugin.schedule}"`);
      continue;
    }

    cron.schedule(plugin.schedule, () => {
      void runWebPlugin(plugin);
    });

    // Run once at startup so ingestion begins without waiting for the first tick.
    void runWebPlugin(plugin);
  }
}
