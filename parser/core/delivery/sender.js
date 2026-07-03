import {
  markScrapedItemDelivered,
  markScrapedItemSkipped,
  releaseScrapedItemReservation,
  reserveScrapedItem,
  saveNewsItem,
} from '../storage/mongo.js';
import { buildCollectorOutputs } from '../ai/ai-layer.js';

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

// A 4xx (except 429) means the request itself is invalid — retrying it unchanged will always fail,
// so the item must be dropped rather than blocking the queue. 429 and 5xx/network errors are
// transient and keep their retry behavior.
export function isPermanentHttpStatus(status) {
  return status >= 400 && status < 500 && status !== 429;
}

class DeliveryError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'DeliveryError';
    this.status = status;
    this.permanent = isPermanentHttpStatus(status);
  }
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
      'X-Internal-Token': process.env.INTERNAL_TOKEN,
    },
    body: JSON.stringify(ingestRequest),
  });

  if (!response.ok) {
    throw new DeliveryError(`RAG ingest failed with HTTP ${response.status}`, response.status);
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
    throw new DeliveryError(`News ingest failed with HTTP ${response.status}`, response.status);
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
        const isReserved = await reserveScrapedItem(item);

        if (!isReserved) {
          console.log(`Duplicate item skipped: ${item.source} ${item.url || item.publishedAt}`);
          continue;
        }

        const outputs = await buildCollectorOutputs(item);

        if (outputs.skipped) {
          console.log(`Item skipped before downstream outputs: ${item.source} ${outputs.reason}`);
          await markScrapedItemSkipped(item, outputs.reason);
          continue;
        }

        console.log(`AI layer mode: ${outputs.ai.mode}`);
        await saveNewsItem(outputs.newsItem, item);
        await postItem(outputs.ingestRequest);
        await postNewsItem(outputs.newsItem);
        await markScrapedItemDelivered(item);
      } catch (error) {
        if (error.permanent) {
          console.error(
            `Dropping item ${item.id} (permanent HTTP ${error.status}): ${error.message}`,
          );

          try {
            await markScrapedItemSkipped(item, `permanent delivery failure: HTTP ${error.status}`);
          } catch (skipError) {
            console.error(`Failed to mark item skipped ${item.id}:`, skipError.message);
          }

          continue;
        }

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
