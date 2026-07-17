# Task 3 report — Admin news/announcements API

Date: 2026-07-17

## Scope completed

Implemented Task 3 on the existing backend News resource only:

- added admin-only News list/update/delete endpoints
- added `isAnnouncement` filtering for admin news listing and the existing public news list
- preserved parser ingest behavior and existing public news item lookup routes
- enforced admin auth on admin News routes
- enforced a safe editable-field allowlist for News updates
- preserved unrelated frontend changes already present in the worktree

No user/settings/frontend behavior was changed as part of this task.

## Files changed

- `backend_app/src/features/news/news.model.js`
- `backend_app/src/features/news/news.repository.js`
- `backend_app/src/features/news/news.service.js`
- `backend_app/src/features/news/news.controller.js`
- `backend_app/src/features/news/news.routes.js`
- `backend_app/src/features/news/news.schema.js`
- `backend_app/test/admin-news.test.js`

## Implementation details

### Admin routes

Added:

- `GET /news/admin`
- `PATCH /news/admin/:id`
- `DELETE /news/admin/:id`

All three routes now require:

- `authenticate`
- `authorize("admin")`

The `/news/admin` route is registered before `/:id` so the string `admin` no longer falls through to the existing object-id validator.

### Announcement filtering

Added Joi-backed query validation for:

- public `GET /news`
- admin `GET /news/admin`

Both now accept optional `isAnnouncement` filtering, with the public route continuing to return the same paginated shape:

```json
{
  "news": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1,
    "hasMore": false
  }
}
```

### Editable-field allowlist

Centralized the admin-editable News fields in `NEWS_ADMIN_EDITABLE_FIELDS` and filtered update payloads through that allowlist in the service layer.

Explicitly rejected parser-managed / non-editable fields in the update schema:

- `externalId`
- `source`
- `createdAt`
- `updatedAt`

This keeps parser ingest ownership intact while still allowing admin edits to presentation/content fields such as title, summary, body, tags, dates, images, and `isAnnouncement`.

### Repository/service changes

Added repository support for:

- filtered News queries including `isAnnouncement`
- `findByIdAndUpdate`
- `findByIdAndDelete`

Added service support for:

- admin list
- update by allowlist
- delete with 404 handling

Public mapping remains through `toPublicNews`, so response shape stays stable.

## TDD evidence

Created `backend_app/test/admin-news.test.js` first, covering:

- admin auth on News admin routes
- admin list with announcement filtering
- public news list announcement filtering with pagination preserved
- admin News patch for editable fields
- rejection of parser-managed fields outside the allowlist
- admin News delete

Initial red run failed because:

- `/news/admin` was being matched by the existing `/:id` route
- admin patch/delete routes did not exist yet

After implementation, the focused suite passed.

## Verification run

### Focused News tests

Command:

```bash
node --test test/admin-news.test.js test/news-assistant.test.js
```

Result:

- 7 tests passed
- 0 failed

### Full backend regression

Command:

```bash
npm test
```

Result:

- 42 tests passed
- 0 failed

## Risks / concerns

- `isAnnouncement` filtering was added to the existing public `GET /news` route in addition to the admin list. This matches the task wording about announcement filtering on the existing News resource and keeps the change backend-only, but if another task expected that filter to be admin-only, that assumption should be checked during integration.
- No frontend admin wiring was changed here by request, so these endpoints are ready for backend integration but not yet consumed by UI code in this task.

## Commit

Task-specific commit created after staging only the Task 3 backend/report files. Unrelated frontend edits were left untouched.
