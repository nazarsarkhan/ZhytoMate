# ZhytoMate — Backend App

Express API that is the **only** thing the browser talks to. Owns users, auth, appeals, surveys,
and chat-conversation persistence; proxies AI questions and photo triage to `../ml-service` (which
the browser never reaches directly) using a shared `X-Internal-Token`. Serves the built
`frontend_app` in production.

## What it does

- **Auth:** register/login, JWT access (15m) + refresh (7d) tokens, password change (bumps
  `refreshTokenVersion` to invalidate every other session).
- **Profile:** name, phone, address, avatar (upload + replace, with a default fallback on the
  frontend when unset).
- **Appeals:** citizens submit a photo report; the photo is sent to `ml-service`'s vision endpoint
  for an AI-suggested category/description/severity in the same round trip as the upload, before
  the citizen confirms and creates the appeal.
- **Surveys/polls:** vote once per survey per user; tallies computed server-side.
- **Assistant + chat history:** proxies a question to `ml-service`'s RAG, then persists the
  exchange into a `Conversation` (one document per thread, embedded messages) so the citizen can
  browse past conversations and continue any of them later.

## Stack

Express 5, MongoDB/Mongoose, JWT (`jsonwebtoken`), Joi validation, Multer (file uploads),
`swagger-ui-express`. No ORM abstraction beyond Mongoose; no framework beyond Express itself.

## Project structure

```
src/
  features/<name>/
    <name>.routes.js       Express Router — wiring only
    <name>.controller.js   req/res handling; orchestrates one or more services
    <name>.service.js      business logic; NEVER imports another feature's service directly
    <name>.repository.js   Mongoose queries
    <name>.model.js        Mongoose schema + a toPublicX() mapper (never leak the raw document)
    <name>.schema.js        Joi request-validation schemas
  features/
    auth/           register, login, refresh, password change
    user/           profile read/update, avatar upload
    appeal/         photo reports, vision-triage round trip
    survey/         polls + votes
    assistant/      proxies to ml-service; orchestrates conversation persistence at the controller
    conversation/   chat history — Conversation model + list/detail endpoints
  shared/           ApiError, mlClient.js (the ONLY module allowed to call ml-service), validate.js
  middleware/       auth guard, centralized error handler
  config/           env var loading
  swagger/          hand-maintained OpenAPI spec served at /docs
```

Every feature follows the same `routes → controller → service → repository → model` chain. A
service must never import another feature's service directly — if two features need to compose
(e.g. `assistant` persisting into `conversation`), that composition happens in the **controller**,
which is allowed to call multiple services; that's what a controller is for.

## Setup

```bash
cp .env.example .env
```

| Var | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | sign the two token types independently |
| `ML_BASE_URL` | where `ml-service` is reachable (default `http://localhost:8000`) |
| `INTERNAL_TOKEN` | **must exactly match** `ml-service/.env`'s `INTERNAL_TOKEN` |
| `CORS_ORIGINS` | comma-separated allowlist; irrelevant in dev since Vite's proxy makes browser requests same-origin |

## Running

```bash
npm install
node src/server.js              # :3000 by default
npm run seed:demo               # demo appeals/surveys for a pre-registered user
```

`ml-service` must already be up and reachable at `ML_BASE_URL` for the Assistant/Appeals features
to work — everything else (auth, surveys, profile) works standalone against MongoDB alone.

In production, this process also serves `frontend_app`'s built `dist/` directly
(`npm run build` in `frontend_app/` first) — single origin, no CORS needed between the two.

API docs (Swagger UI, hand-maintained): `http://localhost:3000/docs`.

## API

All routes below `/auth/register`, `/auth/login`, and `/auth/refresh` require no auth; everything
else requires `Authorization: Bearer <accessToken>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | create an account |
| POST | `/auth/login` | get an access + refresh token pair |
| POST | `/auth/refresh` | exchange a refresh token for a new access token |
| GET | `/auth/me` | current user (identical payload to `/users/me`, kept for auth-flow convenience) |
| PATCH | `/auth/password` | change password; invalidates every other session |
| GET | `/users/me` | current user's full profile |
| PATCH | `/users/me/name` | update name/phone |
| PATCH | `/users/me/address` | update address |
| POST | `/users/me/avatar` | upload/replace avatar photo (multipart, field `avatar`) |
| GET | `/users/:id` | look up another user by id |
| POST | `/appeals` | create a photo-report appeal |
| POST | `/appeals/upload` | upload a photo (multipart, field `photo`), get an AI-suggested triage back |
| GET | `/appeals/me` | current user's appeals |
| GET | `/appeals/:id` | one appeal (404 if not yours) |
| POST | `/surveys` | create a survey (admin role required) |
| GET | `/surveys` | list surveys, with this user's vote + live tallies |
| GET | `/surveys/progress` | this user's voting progress across surveys |
| GET | `/surveys/:id` | one survey |
| POST | `/surveys/:id/vote` | cast (or change) a vote |
| POST | `/assistant/query` | ask the RAG assistant; persists the exchange, returns `conversationId` |
| GET | `/conversations` | list this user's past conversations |
| GET | `/conversations/:id` | one conversation's full message history (404 if not yours) |

## Testing

No test suite is configured yet (`npm test` is a stub). `ml-service` has the project's real test
discipline (pytest, ~266 tests) — see its README.

## Notes

- `backend_app`'s uploaded files (`uploads/appeals/`, `uploads/avatars/`) are gitignored and served
  statically at `/uploads/*`; filenames are always a random UUID + a mime-derived extension, never
  the client-supplied name.
- See the root [`CLAUDE.md`](../CLAUDE.md) for the full integration history with `ml-service` and
  `frontend_app`, including a couple of local port-collision workarounds specific to one dev
  machine that don't apply to a fresh clone.
