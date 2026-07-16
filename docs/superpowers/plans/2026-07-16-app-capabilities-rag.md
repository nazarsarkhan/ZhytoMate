# RAG App Capabilities Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, verified links from the Zhytomate assistant to user-facing app pages without exposing admin routes or inventing URLs.

**Architecture:** The ML service owns a deterministic capability catalog and returns a typed `app_links` list alongside the factual RAG response. The backend normalizes and filters that list again before returning it to the browser. The frontend renders internal routes with React Router `Link`; external evidence remains separate.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, pytest; Node.js, Express, React, React Router, Playwright; Docker Compose.

## Global Constraints

- Never include `/admin/*`, absolute URLs, protocol-relative URLs, `javascript:`, or unknown routes in `app_links`.
- `app_links` is navigation metadata, not factual evidence; never merge it into `sources_used`.
- Return at most three unique links and return `[]` for ambiguous, unsafe, or unsupported requests.
- Preserve the existing source suppression rule for ungrounded or unverified factual answers.
- Do not change the existing appeal action-card state machine.
- Keep all existing user-facing routes authenticated through the current route guards.
- Use TDD for each behavior: write the failing test, run it red, implement minimally, then run it green.

---

### Task 1: Add the capability contract and deterministic catalog

**Files:**
- Create: `ml-service/app/domain/app_capabilities.py`
- Create: `ml-service/tests/unit/test_app_capabilities.py`
- Modify: `ml-service/app/schemas/query.py`
- Modify: `ml-service/tests/contract/test_api_contracts.py`

**Interfaces:**
- Produces `AppLink` with fields `capability`, `label`, `route`, and `reason`.
- Produces `match_app_capabilities(query: str) -> list[AppLink]`.
- Produces `validate_app_route(route: str) -> str | None`.

- [ ] **Step 1: Write failing catalog tests.** Cover Ukrainian/Russian/English aliases for transport, contacts, appeals, polls, outages, places, news, profile, and history; assert maximum three results, deduplication, unknown questions returning `[]`, and `/admin/*`/absolute/unsafe route rejection.

- [ ] **Step 2: Run the focused tests and verify red.**

Run: `rtk pytest ml-service/tests/unit/test_app_capabilities.py -q`

Expected: FAIL because the catalog module and functions do not exist.

- [ ] **Step 3: Implement the catalog.** Store only user-facing route templates already declared in `frontend_app/src/App.jsx`; normalize case, punctuation, and common Cyrillic transliteration variants; score exact aliases before weaker substring matches; return stable order and no more than three links. Make route validation accept only relative paths in the explicit allowlist and reject `/admin`, schemes, `//`, control characters, and unknown prefixes.

- [ ] **Step 4: Extend the Pydantic response contract.** Add `AppLink` and `app_links: list[AppLink] = []` to `ml-service/app/schemas/query.py`; update contract assertions to require `app_links == []` for an unrelated empty-KB query.

- [ ] **Step 5: Run the focused tests green.**

Run: `rtk pytest ml-service/tests/unit/test_app_capabilities.py ml-service/tests/contract/test_api_contracts.py -q`

Expected: all selected tests pass.

---

### Task 2: Integrate capability matching into the ML response

**Files:**
- Modify: `ml-service/app/services/rag_service.py`
- Modify: `ml-service/tests/unit/test_rag_service.py`
- Modify: `ml-service/tests/flows/test_rag_flow.py`

**Interfaces:**
- Consumes `match_app_capabilities()` and `AppLink` from Task 1.
- Produces `QueryResponse.app_links` for safe, high-confidence capability matches.

- [ ] **Step 1: Add failing service tests.** Assert that “де подивитися маршрути?” returns `/services/transport`, that contacts/polls/appeals/outages/places/news/profile/history map to their exact routes, and that an unrelated query, blocked query, and ambiguous query return an empty list.

- [ ] **Step 2: Run those tests and verify red.**

Run: `rtk pytest ml-service/tests/unit/test_rag_service.py ml-service/tests/flows/test_rag_flow.py -q`

Expected: failures because `RagService` does not populate `app_links`.

- [ ] **Step 3: Implement minimal integration.** Match capabilities from the original user query after the existing safety/routing decision. Do not call the LLM solely to generate links. For blocked responses return `[]`; for a high-confidence deterministic capability match return validated links even if factual `sources_used` is empty, because the route itself is trusted app metadata. Keep app links out of answer caching only if their catalog revision is not part of the cache key; otherwise include a capability catalog revision in the response-cache revision.

- [ ] **Step 4: Verify ML tests green.**

Run: `rtk pytest ml-service/tests/unit/test_rag_service.py ml-service/tests/flows/test_rag_flow.py ml-service/tests/contract/test_api_contracts.py -q`

Expected: all selected tests pass with existing source suppression behavior unchanged.

---

### Task 3: Normalize and revalidate links in backend

**Files:**
- Modify: `backend_app/src/shared/mlClient.js`
- Modify: `backend_app/src/features/assistant/assistant.service.js`
- Create: `backend_app/test/assistant-links.test.js`

**Interfaces:**
- `queryAssistant()` returns `appLinks` in camelCase.
- Backend exposes only normalized `{ capability, label, route, reason }` objects.

- [ ] **Step 1: Write failing backend tests.** Feed valid, malformed, external, duplicate, and admin links through the ML-client normalization boundary; assert valid links survive, malformed links are removed, duplicates collapse, and max length is three.

- [ ] **Step 2: Run the focused backend test and verify red.**

Run: `rtk node --test test/assistant-links.test.js` from `backend_app`.

Expected: FAIL because `queryAssistant()` currently drops `app_links` and has no link sanitizer.

- [ ] **Step 3: Implement normalization.** Add a small pure sanitizer in the backend boundary; map `result.app_links` to `appLinks`, validate relative routes against the same explicit allowlist, coerce only strings, deduplicate by route, and cap at three. Do not accept model-provided external URLs.

- [ ] **Step 4: Verify backend tests and existing backend suite.**

Run: `rtk node --test test/assistant-links.test.js` and `rtk npm test` from `backend_app`.

Expected: focused tests and the complete backend suite pass.

---

### Task 4: Render internal links in the assistant UI

**Files:**
- Modify: `frontend_app/src/pages/Assistant/index.jsx`
- Create: `frontend_app/src/components/assistant/AppCapabilityLinks.jsx`
- Create: `frontend_app/src/lib/appRoutes.js`
- Create: `frontend_app/e2e/app-capability-links.spec.js`
- Modify: `frontend_app/e2e/assistant.spec.js` or the existing assistant e2e file discovered during implementation

**Interfaces:**
- `AppCapabilityLinks({ links })` renders internal `<Link>` elements only for validated app routes.
- `APP_ROUTE_ALLOWLIST` is the frontend copy of the explicit user-facing route allowlist and rejects admin/external paths.

- [ ] **Step 1: Write failing frontend Playwright assertions.** Assert that a valid transport link renders as an internal anchor with `href="/services/transport"`, malformed/admin/external links render nothing, and the assistant message keeps external `sources_used` links as external anchors.

- [ ] **Step 2: Run the focused frontend test and verify red.**

Run: `rtk playwright test e2e/app-capability-links.spec.js --reporter=line` from `frontend_app`.

Expected: FAIL because `appLinks` is not carried by the hook/message state and no capability link component exists.

- [ ] **Step 3: Implement UI support.** In `useAssistantChat` map `app_links` to `appLinks`; in `AssistantPage` store it on assistant messages; render `AppCapabilityLinks` below the answer using React Router `Link` (the current React Router contract supports string `to` paths). Keep the existing `LinkifiedText` behavior unchanged for external URLs.

- [ ] **Step 4: Add all-route coverage.** Iterate over the frontend allowlist in a Playwright test, navigate to each route as an authenticated user, and assert the expected page heading or explicit empty state. Add a negative assertion that `/admin/*` never appears in assistant capability links.

- [ ] **Step 5: Verify frontend tests and build.**

Run: `rtk playwright test --reporter=line` and `rtk npm run build` from `frontend_app`.

Expected: all existing and new frontend checks pass.

---

### Task 5: Full-stack contract, Docker smoke test, and documentation

**Files:**
- Modify: `ml-service/tests/contract/test_api_contracts.py` if final response fixtures need completion
- Modify: `backend_app/test/assistant-links.test.js` if HTTP-level proxy coverage is needed
- Modify: `frontend_app/e2e/assistant.spec.js` if final browser flow needs a real API response fixture
- Create: `docs/superpowers/plans/2026-07-16-app-capabilities-rag.md` (this plan)

- [ ] **Step 1: Run complete service suites.**

Run `rtk pytest -q` from `ml-service`, `rtk npm test` from `backend_app`, and `rtk playwright test --reporter=line` from `frontend_app`.

Expected: ML, backend, and frontend tests all pass.

- [ ] **Step 2: Build and restart the application image.**

Run: `rtk docker compose up -d --build backend`

Expected: backend serves a bundle containing the new assistant link UI and ML remains healthy.

- [ ] **Step 3: Smoke-test the deployed stack.**

Check `rtk docker compose ps`; verify backend/ML/Postgres/Mongo are running or healthy. Use the existing authenticated Playwright flow to ask a transport question and assert a clickable `/services/transport` link, then ask an unknown question and assert no app link or factual source block appears.

- [ ] **Step 4: Review the final diff and document the contract.**

Run `rtk git diff --check` and record the app-link response shape and route allowlist location in the project documentation without staging unrelated user changes.

- [ ] **Step 5: Commit only the feature changes.**

Use a focused commit such as `feat: add safe RAG links to app capabilities`; do not include pre-existing dirty worktree files unrelated to this feature.
