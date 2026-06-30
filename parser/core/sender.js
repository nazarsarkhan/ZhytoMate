import {
  markScrapedItemDelivered,
  releaseScrapedItemReservation,
  reserveScrapedItem,
} from './mongo.js';
import { buildCollectorOutputs } from './ai-layer.js';

const retryDelayMs = 5000;
const queue = [];
let isDraining = false;
let retryTimer = null;

function getRagUrl() {
  return process.env.RAG_URL || 'http://localhost:8000/api/v1/knowledge/ingest';
}

function getNewsUrl() {
  return process.env.NEWS_API_URL || 'http://localhost:8000/api/v1/news';
}

function isRagSendEnabled() {
  return process.env.RAG_SEND_ENABLED === 'true';
}

function isNewsSendEnabled() {
  return process.env.NEWS_SEND_ENABLED === 'true';
}

async function postItem(ingestRequest) {
  if (!isRagSendEnabled()) {
    console.log('IngestRequest ready for ML service:');
    console.log(JSON.stringify(ingestRequest, null, 2));
    return;
  }

  const response = await fetch(getRagUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(ingestRequest),
  });

  if (!response.ok) {
    throw new Error(`RAG ingest failed with HTTP ${response.status}`);
  }
}

async function postNewsItem(newsItem) {
  if (!isNewsSendEnabled()) {
    console.log('NewsItem ready for main backend:');
    console.log(JSON.stringify(newsItem, null, 2));
    return;
  }

  const response = await fetch(getNewsUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(newsItem),
  });

  if (!response.ok) {
    throw new Error(`News ingest failed with HTTP ${response.status}`);
  }
}

function scheduleRetry() {
  if (retryTimer) {
    return;
  }

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drainQueue();
  }, retryDelayMs);
}

async function drainQueue() {
  if (isDraining) {
    return;
  }

  isDraining = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift();

      try {
        const outputs = await buildCollectorOutputs(item);

        if (outputs.skipped) {
          console.log(`Item skipped before downstream outputs: ${item.source} ${outputs.reason}`);
          continue;
        }

        const isReserved = await reserveScrapedItem(item);

        if (!isReserved) {
          console.log(`Duplicate item skipped: ${item.source} ${item.url || item.publishedAt}`);
          continue;
        }

        console.log(`AI layer mode: ${outputs.ai.mode}`);
        await postItem(outputs.ingestRequest);
        await postNewsItem(outputs.newsItem);
        await markScrapedItemDelivered(item);
      } catch (error) {
        console.error(`Failed to send item ${item.id}:`, error.message);

        try {
          await releaseScrapedItemReservation(item);
        } catch (releaseError) {
          console.error(`Failed to release item reservation ${item.id}:`, releaseError.message);
        }

        queue.unshift(item);
        scheduleRetry();
        break;
      }
    }
  } finally {
    isDraining = false;
  }
}

/**
 * Add one normalized item to the in-memory queue and start delivery.
 */
export function enqueueItem(item) {
  queue.push(item);
  void drainQueue();
}

/**
 * Add multiple normalized items to the in-memory queue.
 */
export function enqueueItems(items) {
  for (const item of items) {
    queue.push(item);
  }

  void drainQueue();
}

export function getQueueSize() {
  return queue.length;
}
