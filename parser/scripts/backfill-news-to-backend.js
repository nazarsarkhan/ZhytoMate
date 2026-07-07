import 'dotenv/config';
import { closeMongo, initMongo } from '../core/storage/mongo.js';

const defaultNewsApiUrl = 'http://localhost:3000/news/ingest';
const batchSize = 25;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    limit: 0,
    quiet: false,
    since: null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--quiet') {
      options.quiet = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit must be a positive integer');
      }
      options.limit = value;
      continue;
    }

    if (arg.startsWith('--since=')) {
      const value = arg.slice('--since='.length);
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error('--since must be a valid date or ISO datetime');
      }
      options.since = date.toISOString();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getNewsApiUrl() {
  return process.env.NEWS_API_URL || defaultNewsApiUrl;
}

function getInternalToken() {
  return process.env.INTERNAL_TOKEN || '';
}

function toBackendPayload(document) {
  const {
    _id,
    publishedDate,
    sourceItemId,
    sourceUrl,
    sourceType,
    createdAt,
    updatedAt,
    ...newsItem
  } = document;

  return newsItem;
}

function buildQuery(options) {
  if (!options.since) {
    return {};
  }

  const sinceDate = options.since.slice(0, 10);
  return {
    publishedDate: { $gte: sinceDate },
  };
}

async function postNewsItem(newsApiUrl, token, newsItem) {
  const response = await fetch(newsApiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Internal-Token': token,
    },
    body: JSON.stringify(newsItem),
  });

  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new Error(
    `HTTP ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const newsApiUrl = getNewsApiUrl();
  const token = getInternalToken();

  if (!options.dryRun && !token) {
    throw new Error('INTERNAL_TOKEN is required unless --dry-run is used');
  }

  const { newsItems } = await initMongo();
  const query = buildQuery(options);
  const cursor = newsItems
    .find(query)
    .sort({ publishedDate: -1, source: 1 })
    .allowDiskUse(true)
    .batchSize(batchSize);

  if (options.limit > 0) {
    cursor.limit(options.limit);
  }

  let seen = 0;
  let sent = 0;
  let failed = 0;

  console.log(`Reading parser news from Mongo with query: ${JSON.stringify(query)}`);
  console.log(`Backend news ingest endpoint: ${newsApiUrl}`);

  for await (const document of cursor) {
    seen += 1;
    const payload = toBackendPayload(document);
    const label = `${payload.external_id || document._id} "${payload.title || ''}"`;

    if (options.dryRun) {
      if (!options.quiet) {
        console.log(`[dry-run] would send ${label}`);
      }
      continue;
    }

    try {
      await postNewsItem(newsApiUrl, token, payload);
      sent += 1;
      if (!options.quiet) {
        console.log(`[sent] ${label}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[failed] ${label}: ${error.message}`);
    }

    if (options.quiet && seen % 50 === 0) {
      console.log(`Progress. Read: ${seen}. Sent: ${sent}. Failed: ${failed}.`);
    }
  }

  console.log(
    `Done. Read: ${seen}. Sent: ${sent}. Failed: ${failed}. Dry run: ${options.dryRun}.`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await closeMongo();
}
