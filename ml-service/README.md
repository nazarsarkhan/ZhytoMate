# ZhytoMate — ML Service

FastAPI service that answers civic questions for Zhytomyr residents via RAG and triages photo
reports (potholes, garbage, broken lighting, …) via computer vision. Internal-only — it is never
called directly from a browser; `backend_app` is the sole client, authenticating with a shared
`X-Internal-Token`.

Full architecture and every ADR live in [`../docs/SYSTEM_DESIGN.md`](../docs/SYSTEM_DESIGN.md)
(v4). This README is the quickstart; that document is the source of truth for *why*.

## What it does

- **Civic Q&A (RAG):** hybrid dense (pgvector) + lexical (Postgres full-text) retrieval, fused by
  Reciprocal Rank Fusion, answered by a hosted multimodal LLM. Retrieval decides whether an answer
  is *grounded* in the knowledge base, but the assistant always replies — an ungrounded query (a
  KB gap, or just ordinary conversation) still gets a real, honest answer instead of a flat refusal.
- **Multilingual input, wartime-restricted output:** accepts uk/ru/en queries, but **never answers
  in Russian**, regardless of the question's language — a deliberate policy, not a technical
  limitation.
- **OPSEC content-safety gate:** a two-layer filter (instant keyword heuristic, then an LLM
  classification pass) refuses queries that look like an attempt to extract reconnaissance-useful
  information (troop positions, guard schedules, patrol routes, …), in any of the three languages.
  Fails closed — if the classifier itself errors or times out, the query is refused, not allowed
  through.
- **Vision triage:** classifies a submitted photo into one of 9 categories (pothole, garbage,
  street lighting, …) with a severity score and a suggested description, for `backend_app`'s
  appeals feature to pre-fill.
- **Query routing (R2RAG):** a pure heuristic classifies each query SIMPLE or COMPLEX. SIMPLE takes
  a single-shot retrieve→generate path; COMPLEX can decompose into sub-queries, retrieve each in
  parallel, and synthesize one answer (gated by `AGENT_RAG_ENABLED`, off by default — see Notes).

## Stack

FastAPI (async), Postgres 16 + pgvector (HNSW), OpenAI (`text-embedding-3-large` embeddings + a
hosted multimodal chat/vision model), asyncpg, httpx, pydantic v2 + pydantic-settings, tenacity,
structlog, Prometheus. No LangChain/LlamaIndex — plain Python behind small protocol ports.

## Project structure

```
app/
  api/            FastAPI routers (health, chat/query, knowledge/ingest, vision/analyze) — HTTP only
  services/       Orchestration: rate-limit → classify → cache → pipeline → map to HTTP contract
  pipeline/       R2RAG: base (shared tail), simple (single-shot), agent (decompose/synthesize)
  domain/         Pure functions only — no I/O. classifier, confidence, language, opsec, prompts, …
  components/     Concrete adapters behind protocols.py ports — embedder, llm, repository, retriever
  schemas/        Pydantic request/response + internal DTOs
  observability/  Logging setup
  background/     TTL reaper for expired news
db/               SQL migrations (pgvector schema, HNSW indexes)
docs/ (repo root) SYSTEM_DESIGN.md — full ADR log and architecture rationale
tests/
  unit/           Pure domain functions, no I/O
  flows/          Pipeline-level tests against fakes (no real Postgres/OpenAI)
  contract/       HTTP-level tests, real Postgres via testcontainers, fakes for the LLM
  integration/    Real Postgres, exercises SQL directly (hybrid retrieval, HNSW filtering)
eval/             Offline quality gate — retrieval hit-rate + routing accuracy against a golden set
```

Every module's docstring states its own **Purpose / Layer / May import / Must NOT import**
contract — read it before editing. Layering is `api → service → components/repository`, plus the
`pipeline/` sub-layer; `domain/*` never touches I/O; services never import other services.

## Setup

```bash
cp .env.example .env   # fill in OPENAI_API_KEY and a real INTERNAL_TOKEN
```

Key env vars (see `.env.example` for the full list with defaults):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `OPENAI_API_KEY` | embeddings + chat + vision |
| `INTERNAL_TOKEN` | shared secret — **must match** `backend_app`'s `INTERNAL_TOKEN` exactly |
| `SIM_GATE` / `SIM_HIGH` | dense top-1 similarity thresholds for the grounded/ungrounded decision — calibrated per-deployment via `scripts/calibrate_thresholds.py`, don't hand-pick these |
| `AGENT_RAG_ENABLED` | COMPLEX queries use the decomposition pipeline when `true`, else fall back to the simple pipeline |
| `RATE_LIMIT_PER_MINUTE` | per-user, Postgres-backed, hashed key |

## Running

**Full local stack (Postgres + this service, via Docker):**
```bash
docker compose up -d --build
curl -s localhost:8000/health/ready   # expect {"status":"ready"}
```
After editing `.env`, `docker compose restart` will **not** pick up the changes — use
`docker compose up -d --force-recreate ml` (or `--build` if code also changed).

**Standalone (needs a Postgres reachable at `DATABASE_URL` already running):**
```bash
pip install -e .
uvicorn app.main:app --reload
```

## Testing

```bash
pytest                  # full suite — spins up a real Postgres via testcontainers
pytest -m "not slow"    # fast lane: unit + flow tests only, no containers
ruff check .
mypy app/
python -m eval.run_eval # offline quality gate: retrieval hit-rate + routing accuracy
```

## API

`X-Internal-Token` header required on everything except `/health/*` and `/metrics`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/live` | liveness |
| GET | `/health/ready` | readiness (DB + embedder reachable) — the compose healthcheck gate |
| GET | `/health/deps` | dashboard-only dependency detail (DB, OpenAI, embedder, pool stats); always 200 |
| POST | `/api/v1/chat/query` | ask a civic question, get an answer + sources + confidence |
| POST | `/api/v1/knowledge/ingest` | add a document to the knowledge base (used by `parser/`) |
| DELETE | `/api/v1/knowledge/{document_id}` | delete a document and all its chunks (idempotent) |
| POST | `/api/v1/vision/analyze` | classify a photo report |
| GET | `/metrics` | Prometheus scrape endpoint |

Full request/response shapes: [`../docs/zhytomate-ml-openapi.yaml`](../docs/zhytomate-ml-openapi.yaml).

## Notes

- `AGENT_RAG_ENABLED` defaults to `false` — measured slower (6-10.5s vs 2.5-4.7s) for no answer-
  quality gain on the current seed. The decomposition pipeline is fully implemented and tested; it
  just isn't worth the latency yet.
- A dense query-embedding cache lives in-process (`Embedder`) — restarting the container is always
  safe (no volume-mounted state) and is the fix if a query embedded during a transient OpenAI
  blip ever gets stuck returning "no info" for its exact text.
- See the root [`CLAUDE.md`](../CLAUDE.md) for the full history of gotchas, known issues, and why
  things are built the way they are.
