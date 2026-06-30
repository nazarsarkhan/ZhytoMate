import { TelegramClient } from 'gramjs';
import { StringSession } from 'gramjs/sessions/index.js';
import { NewMessage } from 'gramjs/events/index.js';
import { normalizeItem } from './normalizer.js';
import { enqueueItem, enqueueItems } from './sender.js';

let client;
const defaultBackfillDays = 30;
const defaultBackfillLimit = 1000;

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Telegram client startup`);
  }

  return value;
}

function getEnvNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isBackfillEnabled() {
  return process.env.TG_BACKFILL_ON_START !== 'false';
}

function normalizeChannelUsername(username) {
  return username.replace(/^@/, '').toLowerCase();
}

function normalizeChannelId(channelId) {
  if (channelId === undefined || channelId === null || channelId === '') {
    return null;
  }

  return String(channelId).trim();
}

function getChannelIdVariants(channelId) {
  const normalizedId = normalizeChannelId(channelId);

  if (!normalizedId) {
    return [];
  }

  const withoutMinusPrefix = normalizedId.replace(/^-100/, '');
  const variants = new Set([
    normalizedId,
    withoutMinusPrefix,
    `-100${withoutMinusPrefix}`,
  ]);

  return [...variants];
}

function toTelegramEntityId(channelId) {
  const normalizedId = normalizeChannelId(channelId);

  if (!normalizedId) {
    return null;
  }

  const withChannelPrefix = normalizedId.startsWith('-100')
    ? normalizedId
    : `-100${normalizedId.replace(/^-/, '')}`;

  return Number(withChannelPrefix);
}

function getMessageDate(message) {
  if (!message.date) {
    return new Date();
  }

  if (message.date instanceof Date) {
    return message.date;
  }

  return new Date(Number(message.date) * 1000);
}

function getMessageChannelKeys(message, chat) {
  const keys = [];

  if (chat?.username) {
    keys.push(`username:${normalizeChannelUsername(chat.username)}`);
  }

  for (const id of [
    chat?.id,
    message.peerId?.channelId,
    message.peerId?.chatId,
    message.chatId,
  ]) {
    for (const variant of getChannelIdVariants(id)) {
      keys.push(`id:${variant}`);
    }
  }

  return keys;
}

function buildPluginMap(tgPlugins) {
  const pluginByChannel = new Map();

  for (const plugin of tgPlugins) {
    if (plugin.channelUsername) {
      pluginByChannel.set(
        `username:${normalizeChannelUsername(plugin.channelUsername)}`,
        plugin,
      );
    }

    for (const variant of getChannelIdVariants(plugin.channelId)) {
      pluginByChannel.set(`id:${variant}`, plugin);
    }
  }

  return pluginByChannel;
}

async function resolvePluginEntity(plugin) {
  if (plugin.channelUsername) {
    return client.getInputEntity(normalizeChannelUsername(plugin.channelUsername));
  }

  const channelId = toTelegramEntityId(plugin.channelId);

  if (!channelId) {
    throw new Error('channelUsername or channelId is required');
  }

  return client.getInputEntity(channelId);
}

async function backfillTelegramPlugin(plugin) {
  const backfillDays = getEnvNumber('TG_BACKFILL_DAYS', defaultBackfillDays);
  const backfillLimit = getEnvNumber('TG_BACKFILL_LIMIT', defaultBackfillLimit);
  const cutoff = new Date(Date.now() - backfillDays * 24 * 60 * 60 * 1000);
  const normalizedItems = [];

  try {
    const entity = await resolvePluginEntity(plugin);

    for await (const message of client.iterMessages(entity, { limit: backfillLimit })) {
      if (getMessageDate(message) < cutoff) {
        break;
      }

      const rawItem = plugin.parse(message);

      if (!rawItem) {
        continue;
      }

      normalizedItems.push(normalizeItem(rawItem, plugin, 'telegram'));
    }

    enqueueItems(normalizedItems.reverse());
    console.log(
      `Backfilled ${normalizedItems.length} Telegram items from ${plugin.id} for ${backfillDays} days`,
    );
  } catch (error) {
    console.error(`Telegram backfill failed for ${plugin.id}:`, error);
  }
}

async function backfillTelegramPlugins(tgPlugins) {
  if (!isBackfillEnabled()) {
    console.log('Telegram startup backfill disabled');
    return;
  }

  // Populate entity cache so channel IDs from dialogs can be resolved.
  await client.getDialogs({ limit: 200 });

  for (const plugin of tgPlugins) {
    await backfillTelegramPlugin(plugin);
  }
}

/**
 * Singleton GramJS client. It listens to configured channels and sends parsed
 * messages to the normalizer and sender pipeline.
 */
export async function startTelegramClient(tgPlugins) {
  if (tgPlugins.length === 0) {
    console.log('No enabled Telegram plugins configured');
    return null;
  }

  if (client) {
    return client;
  }

  const apiId = Number(getRequiredEnv('TG_API_ID'));
  const apiHash = getRequiredEnv('TG_API_HASH');
  const session = new StringSession(getRequiredEnv('TG_SESSION'));
  const pluginByChannel = buildPluginMap(tgPlugins);

  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();
  console.log('Telegram client connected');

  await backfillTelegramPlugins(tgPlugins);

  client.addEventHandler(async (event) => {
    const message = event.message;
    const chat = await message.getChat();
    const channelKeys = getMessageChannelKeys(message, chat);
    const plugin = channelKeys
      .map((key) => pluginByChannel.get(key))
      .find(Boolean);

    if (!plugin) {
      return;
    }

    try {
      const rawItem = plugin.parse(message);

      if (!rawItem) {
        return;
      }

      const normalizedItem = normalizeItem(rawItem, plugin, 'telegram');
      enqueueItem(normalizedItem);
    } catch (error) {
      console.error(`Telegram plugin ${plugin.id} failed:`, error);
    }
  }, new NewMessage({}));

  return client;
}

export function getTelegramClient() {
  return client;
}
