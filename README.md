# ZhytoMate

A civic assistant for residents of Zhytomyr, Ukraine — ask it city questions and get answers
grounded in real city-council content, or just talk to it like an assistant; report a pothole or
broken streetlight with a photo and get an AI-suggested category before you submit; vote in city
polls; read local news. Built for **Future in Action 2026**.

Every user-facing answer is wartime-hardened: the assistant **never answers in Russian**
regardless of what language you ask in, and refuses queries that look like an attempt to extract
security-sensitive information (troop positions, guard schedules, patrol routes, …) — see
[`ml-service/README.md`](ml-service/README.md) for how.

## Architecture

```
                                    Zhytomyr city council site + Telegram channels
                                                      │
                                                      ▼
                                              parser/  (Node collector)
                                                      │  ingests civic content
                                                      ▼
Browser ──▶ frontend_app/  ──▶  backend_app/  ──▶  ml-service/
            (React SPA)         (Express,           (FastAPI RAG + vision,
                                  the ONLY thing       internal-only —
                                  the browser talks    never reached by
                                  to; owns users/       the browser directly)
                                  appeals/surveys/           │
                                  chat history)              ▼
                                       │                Postgres + pgvector
                                       ▼
                                    MongoDB
```

`frontend_app` never calls `ml-service` directly — it doesn't hold the internal shared-secret
token that authenticates service-to-service calls. `backend_app` is the sole client of
`ml-service`, and the sole thing the browser ever talks to.

**A note on `docs/`:** [`NODE_SYSTEM_DESIGN.md`](docs/NODE_SYSTEM_DESIGN.md) and
[`COLLECTOR_SYSTEM_DESIGN.md`](docs/COLLECTOR_SYSTEM_DESIGN.md) describe an originally-planned
Telegram-bot-based architecture. What's actually built and running is the web app described above
— `backend_app`/`frontend_app` are a separate, since-added surface, and `parser/` is a working
stand-in for the "Collector" those documents describe, not a literal implementation of them.
[`SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) (v4) documents `ml-service` itself and **is** current.

## Services

| Service | What | Docs |
|---|---|---|
| [`ml-service/`](ml-service) | FastAPI — RAG civic Q&A + photo-report vision triage. Internal-only. | [README](ml-service/README.md) |
| [`backend_app/`](backend_app) | Express — the browser's only front door. Auth, appeals, surveys, chat persistence, proxies AI calls. | [README](backend_app/README.md) |
| [`frontend_app/`](frontend_app) | React SPA — the citizen-facing UI. | [README](frontend_app/README.md) |
| [`parser/`](parser) | Node collector — scrapes the city council site + Telegram, feeds `ml-service`'s knowledge base. | [README](parser/README.md) |

## Quick start

Bring each service up in this order (each one's README has the full detail):

```bash
# 1. ml-service — RAG + vision, needs Postgres+pgvector
cd ml-service && cp .env.example .env   # fill in OPENAI_API_KEY, INTERNAL_TOKEN
docker compose up -d --build
curl -s localhost:8000/health/ready     # {"status":"ready"}

# 2. backend_app — needs MongoDB + the SAME INTERNAL_TOKEN as ml-service
cd ../backend_app && cp .env.example .env
npm install && node src/server.js       # :3000

# 3. frontend_app — dev proxy forwards /api/* to backend_app
cd ../frontend_app && npm install && npm run dev   # :5173

# 4. (optional) parser — populates ml-service's knowledge base from real sources
cd ../parser && cp .env.example .env && npm install && npm start
```

Open `http://localhost:5173`, register an account, and the Assistant tab talks to the real RAG.

## Stack at a glance

Python (FastAPI, async, pydantic v2) for the ML/RAG service · Node.js (Express 5, Mongoose) for the
web backend · React 19 + Vite + Tailwind + TanStack Query for the frontend · Node.js (GramJS,
Cheerio) for the collector · Postgres 16 + pgvector for vector search · MongoDB for everything
else · OpenAI for embeddings, chat, and vision.

## Status

`ml-service` is fully implemented and tested (unit/integration/flow/contract, ~266 tests,
`ruff`/`mypy` clean). The full `frontend_app` ↔ `backend_app` ↔ `ml-service` stack is wired and
verified end-to-end in a real browser. See [`CLAUDE.md`](CLAUDE.md) for the day-to-day working
history — decisions made, bugs found and fixed, and everything still open.

## License

MIT — see [`LICENSE`](LICENSE).
