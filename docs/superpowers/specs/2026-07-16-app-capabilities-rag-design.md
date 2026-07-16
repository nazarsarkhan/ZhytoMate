# App Capabilities Deep Links for RAG

## Goal

Allow the Zhytomate assistant to recommend verified links to user-facing pages inside the app when a resident asks how to use a city feature, while never exposing admin routes or inventing paths.

## Scope

Included:

- user-facing routes already registered in `frontend_app/src/App.jsx`;
- RAG intent matching for application capabilities;
- a structured `app_links` field in the ML/backend assistant response;
- internal React Router links in assistant messages;
- route allowlisting and regression tests.

Excluded:

- every `/admin/*` route;
- automatic creation of new app routes;
- replacing official city/news sources;
- external Google Maps or arbitrary web links as app capabilities;
- changing the existing appeal action-card flow.

## User-facing capability catalog

The catalog is the single source of truth for assistant navigation metadata. Each entry contains:

- stable capability identifier;
- Ukrainian display label;
- concise description;
- multilingual keywords and example phrases;
- exact internal route template;
- category;
- authentication requirement;
- optional route parameter requirement.

Initial capability groups:

- `services`: `/services`, `/services/contacts`, `/services/polls`, `/services/appeals`, `/services/transport`, `/services/outages`;
- `places`: `/places`;
- `news`: `/news`;
- `notifications`: `/notifications`;
- `profile`: `/profile`;
- `history`: `/chat-history`.

Dynamic detail routes are exposed only when a verified entity id exists in the answer context. The catalog must reject routes containing `/admin` or unknown route prefixes.

## Data flow

1. The capability catalog is loaded by the ML service as deterministic metadata or retrieved from a dedicated capability collection.
2. The query classifier/routing stage identifies whether the question is about an app capability.
3. The RAG service selects at most three high-confidence capabilities and validates every route against the allowlist.
4. `QueryResponse` returns `app_links`; absence or low confidence produces an empty list.
5. Backend passes the normalized links through `/assistant/query` without allowing arbitrary model-generated URLs.
6. Frontend renders links with React Router `Link` so they stay inside the app. External sources continue to use normal anchors.

## Response contract

Each app link has:

```json
{
  "capability": "transport",
  "label": "Транспорт",
  "route": "/services/transport",
  "reason": "Переглянути маршрути та транспорт Житомира"
}
```

The route is a validated relative path. The model may suggest a capability, but it may not directly supply an arbitrary URL. Links are omitted when the answer is ungrounded, the intent is ambiguous, the route is not allowlisted, or the user asks for an admin-only feature.

## Safety and quality rules

- Never emit `/admin`, `/admin/*`, authentication-only management routes, `javascript:`, protocol-relative URLs, or absolute URLs as app links.
- Deduplicate links by route and cap the list at three entries.
- Keep app links separate from `sources_used`; app navigation is not evidence for factual claims.
- Preserve the existing rule that unknown factual answers have no sources.
- Use deterministic matching for obvious phrases and RAG/intent matching for paraphrases.
- If a route is changed in the frontend, the route-validation test must fail until the catalog is updated.

## Testing strategy

- Unit tests for catalog lookup, multilingual aliases, route allowlisting, deduplication, and admin-route rejection.
- ML contract tests for `app_links` serialization and empty links on unrelated/low-confidence queries.
- Backend tests for forwarding normalized links and dropping malformed link objects.
- Frontend Playwright tests for rendering internal links with `Link`, preserving external source behavior, and covering all catalog routes.
- Full frontend build, backend tests, ML tests, and Docker smoke verification before completion.

## Acceptance criteria

- A resident question such as “де подивитися маршрути?” returns a clickable internal link to `/services/transport`.
- Questions about contacts, appeals, polls, outages, places, news, profile, and history map to the correct existing pages.
- Unknown or unrelated questions return no app links.
- No response can expose `/admin/*` through app links.
- All generated routes are known to the frontend route registry and all tests pass.
