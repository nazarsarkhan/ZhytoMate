# RAG Message Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated residents rate generated RAG answers and store structured feedback for future RAG improvements.

**Architecture:** Persist stable Mongo `_id` values on conversation messages. Add an authenticated feedback upsert endpoint that verifies the message belongs to the current user. Render local feedback controls in the assistant page and submit them asynchronously through a dedicated React Query mutation.

**Tech Stack:** Express, Joi, Mongoose, React 19, React Query, Playwright, Node test runner.

## Global Constraints

- Feedback is private to the authenticated user.
- Only `up` and `down` votes are accepted.
- A downvote reason is optional and restricted to the documented reason enum.
- The server never trusts a client-provided `userId`.
- Existing assistant source/link behavior and RAG audit behavior must remain unchanged.

---

### Task 1: Persist stable assistant message IDs

**Files:**
- Modify: `backend_app/src/features/conversation/conversation.model.js`
- Modify: `backend_app/src/features/conversation/conversation.repository.js`
- Modify: `backend_app/src/features/assistant/assistant.service.js`
- Test: `backend_app/test/assistant-feedback.test.js`

- [x] Add a failing test asserting a generated assistant result includes a stable 24-character `messageId` and that public conversation messages expose their IDs.
- [x] Run `npm test -- --test-name-pattern="stable assistant message"` and verify the new assertion fails because messages currently disable subdocument IDs.
- [x] Remove `_id: false` from the message schema, preserve the existing message fields, and return the last assistant message ID from `runAssistantQuery`.
- [x] Run the focused test and then the full backend suite; expect all tests to pass.

### Task 2: Add feedback persistence and API

**Files:**
- Create: `backend_app/src/features/assistant/assistantFeedback.model.js`
- Create: `backend_app/src/features/assistant/assistantFeedback.schema.js`
- Create: `backend_app/src/features/assistant/assistantFeedback.service.js`
- Create: `backend_app/src/features/assistant/assistantFeedback.controller.js`
- Modify: `backend_app/src/features/assistant/assistant.routes.js`
- Modify: `backend_app/src/app.js`
- Test: `backend_app/test/assistant-feedback.test.js`

- [x] Add failing validation tests for accepted votes/reasons, invalid enums, bounded text, and missing message IDs.
- [x] Add failing service tests for ownership checks and same-user/message upsert behavior.
- [x] Run the focused tests and verify they fail for missing schema/service/route behavior.
- [x] Implement a Mongoose model with `userId`, `messageId`, `conversationId`, bounded diagnostic fields, timestamps, and a unique `{ userId: 1, messageId: 1 }` index.
- [x] Implement `POST /assistant/feedback` behind `authenticate`; load the user's conversation/message by ID before upserting and reject foreign/missing messages with a 404.
- [x] Return the normalized stored record and never expose another user's feedback.
- [x] Run focused and full backend tests.

### Task 3: Add frontend feedback controls

**Files:**
- Create: `frontend_app/src/hooks/useAssistantFeedback.js`
- Create: `frontend_app/src/components/assistant/MessageFeedback.jsx`
- Modify: `frontend_app/src/pages/Assistant/index.jsx`
- Test: `frontend_app/e2e/assistant-feedback.spec.js`

- [x] Add a failing Playwright test covering visible buttons, selected vote, downvote reason submission, and vote replacement.
- [x] Run the focused Playwright test and verify the controls/request are absent or failing before implementation.
- [x] Add an async mutation using the existing `apiFetch` client; expose pending/error state without blocking the whole composer.
- [x] Render controls only for assistant messages with a stable `messageId`; use Ukrainian accessible labels and `aria-pressed`.
- [x] Add a compact reason popover for downvotes and preserve the prior vote if submission fails.
- [x] Run the focused test and then all frontend Playwright tests.

### Task 4: Final verification

**Files:**
- Modify: `docs/zhytomate-ml-openapi.yaml` or backend OpenAPI source if the project exposes assistant routes there.

- [x] Verify the new endpoint is represented in the generated API documentation if the repository's OpenAPI contract includes backend assistant routes.
- [x] Run backend tests, frontend build, focused feedback Playwright, non-live Playwright, and the live RAG audit in rate-limit-safe sequential chunks.
- [ ] Run `git diff --check`, inspect the final diff, commit, and push the completed feature.
