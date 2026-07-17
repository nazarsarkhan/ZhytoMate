import cron from 'node-cron';
import { normalizeItems } from '../pipeline/normalizer.js';
import { enqueueItems } from '../delivery/sender.js';

export async function runWebPlugin(plugin, { throwOnError = false } = {}) {
  try {
    console.log(`Running web plugin: ${plugin.id}`);
    let streamedRawItemCount = 0;
    const onItems = (rawItems) => {
      const normalizedItems = normalizeItems(rawItems, plugin, 'web');
      streamedRawItemCount += rawItems.length;
      enqueueItems(normalizedItems);
    };
    const rawItems = await plugin.fetch({ onItems });
    const normalizedItems = normalizeItems(rawItems, plugin, 'web');

    // Plugins that do not stream keep the original one-shot behavior. For streaming plugins,
    // only enqueue a possible remainder to avoid sending any item twice.
    if (streamedRawItemCount === 0) {
      enqueueItems(normalizedItems);
    } else if (streamedRawItemCount < rawItems.length) {
      enqueueItems(normalizeItems(rawItems.slice(streamedRawItemCount), plugin, 'web'));
    }

    console.log(`Web plugin ${plugin.id} produced ${normalizedItems.length} item(s)`);
    return normalizedItems;
  } catch (error) {
    console.error(`Web plugin ${plugin.id} failed:`, error);

    if (throwOnError) {
      throw error;
    }

    return [];
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
