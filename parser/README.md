# ZhytoMate — Parser (Collector)

Node.js scraper/collector: crawls Zhytomyr city-council web pages and listens to Telegram channels
for civic news and how-to content, normalizes it, and delivers it into `../ml-service`'s knowledge
base. This is the real, working stand-in for the "Collector" role described in
[`../docs/COLLECTOR_SYSTEM_DESIGN.md`](../docs/COLLECTOR_SYSTEM_DESIGN.md) — that document
describes the originally-planned design; this service is a separate, since-built implementation of
the same job, not a literal build of that spec.

## zt-rada: news and RAG outputs

The `zt-rada` plugin uses one crawl so the city council site is not requested twice, but it has two
explicit output policies:

- the RAG output receives all useful city-council content, including news, documents, calendar
  entries and evergreen pages;
- the news output receives only articles discovered from `/press-center/news` and sends them to the
  parser news collection and the main backend.

This keeps the news feed clean without losing reference material for retrieval. Calendar entries,
documents and other council pages are marked as `document` and remain RAG-only.

## What it does

- **Web scraping** (`plugins/web/`, e.g. `zt-rada.js` for the city council site): scheduled crawls
  (`core/scheduler/`) that follow search-result links to full articles rather than only ingesting
  headlines.
- **Telegram ingestion** (`plugins/tg/`): a GramJS client (`core/telegram/`) reads configured
  channels, backfilling recent history on startup and then listening live.
- **Normalization pipeline** (`core/pipeline/`): turns raw scraped/Telegram content into a common
  shape before it reaches enrichment or delivery.
- **AI enrichment** (`core/ai/`, gated by `AI_LAYER_ENABLED`): classifies/structures content with an
  LLM call; fails open by default (`AI_FAIL_OPEN=true`) so a classify-call outage never blocks
  ingestion.
- **Dedup + delivery** (`core/storage/`, `core/delivery/`): a MongoDB-backed reservation
  (`SCRAPER_DEDUPE_RESERVATION_TTL_MINUTES`) prevents the same item being delivered twice, then
  hands civic content to `ml-service`'s `/knowledge/ingest` and news-block content to a separate
  news endpoint — both gated by their own `*_SEND_ENABLED` flag so a dry run never actually pushes.
- **Document extraction** (`core/extract/`): pulls text out of attached PDFs/DOCX for pages that
  link to documents instead of inlining the content.

## Stack

Plain Node.js (ESM, `type: module`), Express (just for the `/health` endpoint), GramJS
(`telegram` package, aliased as `gramjs`) for Telegram, Cheerio for HTML parsing, `node-cron` for
scheduling, `mongodb` driver directly (no ODM), `pdf-parse`/`mammoth`/`word-extractor` for document
text extraction.

## Project structure

```
index.js                  Entry point: Express /health endpoint, starts scheduler + Telegram client
core/
  telegram/                GramJS client setup, session handling
  scheduler/                Cron-driven web-plugin scheduling
  pipeline/                 Normalization: raw plugin output -> common shape
  ai/                       LLM enrichment (optional, gated by AI_LAYER_ENABLED)
  ingest/                   Maps normalized content to ml-service's RAG ingest payload
  news/                     Maps normalized content to news-block payloads
  delivery/                 Queue/output handling, retry behavior
  storage/                  MongoDB dedupe/reservation logic
  extract/                  PDF/DOCX/DOC text extraction for attachments
plugins/
  web/                      One file per scraped site (zt-rada.js is the real one; example-web.js
                             is a template)
  tg/                       One file per Telegram channel (example-tg.js is a template)
config/sources.js           Which web/tg plugins are enabled
scripts/generate-session.js Interactive one-time Telegram session-string generator
tests/                      node --test unit tests (AI TTL hardening, delivery robustness,
                             zt-rada mapping)
```

Plugin files are kebab-case and export a default object matching the web or Telegram plugin
contract expected by `core/scheduler/`/`core/telegram/` respectively.

## Setup

```bash
cp .env.example .env
```

| Var | Purpose |
|---|---|
| `TG_API_ID` / `TG_API_HASH` | from [my.telegram.org](https://my.telegram.org) — required for the Telegram client |
| `TG_SESSION` | a session string; generate one with `npm run session` on first run |
| `MONGO_URI` | dedupe/delivery-state storage |
| `RAG_URL` / `RAG_SEND_ENABLED` | where civic content is ingested — point at `ml-service`'s `/api/v1/knowledge/ingest`, and flip `RAG_SEND_ENABLED=true` only once you actually want to push |
| `INTERNAL_TOKEN` | must match `ml-service/.env`'s value — required once `RAG_SEND_ENABLED=true` |
| `AI_LAYER_ENABLED` | off by default; turn on + set `OPENAI_API_KEY` to enable enrichment |
| `TG_BACKFILL_ON_START` / `TG_BACKFILL_LIMIT` | how much Telegram history to pull in on a fresh run |

Never commit a real `TG_SESSION` or API credentials — `.env` is gitignored for exactly this reason.

## Running

```bash
npm install
npm run session    # first time only — interactive, writes a session string to paste into .env
npm start          # node index.js
npm run dev         # node --watch index.js, for local iteration
```

To copy already collected news into the main backend without sending `zt-rada` knowledge-base
pages, run a dry-run first and then remove `--dry-run`:

```bash
npm run backfill:news -- --exclude-source=zt-rada --dry-run
npm run backfill:news -- --exclude-source=zt-rada --quiet
```

The backfill uses the parser item's `external_id`; the main backend upserts by that key, so
re-running it does not create duplicate news.

`GET /health` reports Mongo connectivity and which web/Telegram plugins are currently enabled.

## Testing

```bash
npm test           # node --test — runs tests/*.test.js
node --check index.js   # syntax-only check, no execution
```

## Notes

- A full re-seed of `ml-service`'s knowledge base requires resetting **both** dedup layers (the
  RAG's own `knowledge_base` table AND this service's Mongo delivery-state) or the re-run will
  silently ingest nothing — see the root [`CLAUDE.md`](../CLAUDE.md)'s Demo Runbook for the exact
  steps.
- `RAG_SEND_ENABLED`/`NEWS_SEND_ENABLED` default to `false` specifically so this service is safe to
  run and iterate on without accidentally pushing test data into a real knowledge base.
