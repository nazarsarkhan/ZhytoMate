import {
  markScrapedItemDelivered,
  markScrapedItemSkipped,
  releaseScrapedItemReservation,
  reserveScrapedItem,
  saveNewsItem,
} from '../storage/mongo.js';
import { buildCollectorOutputs } from '../ai/ai-layer.js';
import { shouldSendToNews } from './routes.js';

const retryDelayMs = 5000;
const queue = [];
let isDraining = false;
let retryTimer = null;

function getRagUrl() {
  return process.env.RAG_URL || 'http://localhost:8000/api/v1/knowledge/ingest';
}

function getNewsUrl() {
  return process.env.NEWS_API_URL || 'http://localhost:3000/news/ingest';
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

// ml-service's ingest endpoint returns HTTP 200 for "ingested", "duplicate", AND "expired" (the
// born-expired skip) alike — an HTTP-status-only check can't tell a real embedding apart from a
// silent discard. postItem returns that status so the caller (drainQueue) can react correctly:
// "expired" content will never embed no matter how many times it's retried (its expiry is a
// deterministic function of its own published_at + ttl_days), so it must be recorded as skipped,
// not delivered, or it becomes permanently invisible without ever being in the KB.
export async function postItem(ingestRequest) {
  if (!isRagSendEnabled()) {
    console.log('IngestRequest ready for ML service:');
    console.log(JSON.stringify(ingestRequest, null, 2));
    return 'ingested';
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

  const body = await response.json();
  return body.status;
}

async function postNewsItem(newsItem) {
  if (!isNewsSendEnabled()) {
    console.log('NewsItem ready for main backend:');
    console.log(JSON.stringify(newsItem, null, 2));
    return;
  }

  const internalToken = process.env.INTERNAL_TOKEN?.trim();
  if (!internalToken) {
    throw new Error('INTERNAL_TOKEN must be set when NEWS_SEND_ENABLED=true');
  }

  const response = await fetch(getNewsUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Internal-Token': internalToken,
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
        const sendToNews = shouldSendToNews(item, outputs.ingestRequest);

        if (sendToNews) {
          await saveNewsItem(outputs.newsItem, item);
        }

        const ragStatus = await postItem(outputs.ingestRequest);
        // RAG receives both news and reference/instruction content. The news output is
        // deliberately narrower for broad sources such as zt-rada.
        if (sendToNews) {
          await postNewsItem(outputs.newsItem);
        }

        if (ragStatus === 'expired') {
          console.warn(
            `RAG ingest reports already-expired, not embedded: ${item.source} ${item.url || item.publishedAt}`,
          );
          await markScrapedItemSkipped(item, 'rag ingest returned expired');
          continue;
        }

        if (ragStatus !== 'ingested' && ragStatus !== 'duplicate') {
          console.warn(
            `RAG ingest returned unexpected status "${ragStatus}" for item ${item.id}; marking delivered to avoid a retry loop, but this should be investigated`,
          );
        }

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

/**
 * Wait until the current delivery queue and any scheduled retry are finished.
 * One-shot source runners use this before closing MongoDB and exiting.
 */
export async function waitForQueueIdle(pollMs = 50) {
  while (queue.length > 0 || isDraining || retryTimer) {
    await new Promise((resolve) => {
      setTimeout(resolve, pollMs);
    });
  }
}
