# RAG Message Feedback — Design

## Goal

Let a signed-in resident rate each generated RAG answer with a thumbs-up or thumbs-down, while collecting enough structured context to improve routing, retrieval, prompts, and regression tests.

## Scope

- Show feedback controls only for persisted assistant RAG answers.
- Allow one vote per assistant message; a later click changes the existing vote.
- On thumbs-down, offer an optional reason:
  - incorrect answer;
  - missing information;
  - outdated information;
  - poor sources;
  - unclear answer.
- Do not add admin analytics in this iteration; store data so it can be queried later.
- Do not automatically retrain or modify the RAG from feedback.

## Data model

Create a MongoDB `AssistantFeedback` document with a unique `(userId, messageId)` key:

- `userId` — authenticated user reference;
- `messageId` — stable assistant-message ID returned by the assistant API;
- `conversationId` — conversation reference when available;
- `userQuery` and `answer` — captured text at rating time;
- `vote` — `up` or `down`;
- `reason` — optional controlled reason for a downvote;
- `answerStatus`, `verified`, `sourcesUsed`, and `appLinks` — RAG diagnostics;
- `createdAt` and `updatedAt` timestamps.

The API must validate the vote and reason, cap captured text/arrays, and never accept `userId` from the client.

## API

Add an authenticated upsert endpoint:

`POST /assistant/feedback`

Request body:

```json
{
  "messageId": "assistant-message-id",
  "conversationId": "conversation-id",
  "vote": "down",
  "reason": "missing_information",
  "userQuery": "Де ЦНАП?",
  "answer": "...",
  "answerStatus": "ungrounded",
  "verified": false,
  "sourcesUsed": [],
  "appLinks": []
}
```

Return the normalized feedback record. Repeated submissions for the same user/message update the record rather than creating duplicates.

## Frontend

- The assistant API returns a stable `messageId` for generated answers.
- The assistant message stores `messageId` and local `feedback` state.
- Two accessible icon buttons have Ukrainian labels and pressed state.
- The vote is shown immediately; the request runs asynchronously.
- A downvote opens a compact reason popover. Submitting without a reason is allowed.
- Failed submission restores the previous state and shows a small retryable error.
- The initial greeting, user messages, errors, and action cards have no feedback controls.

## Testing

- Backend unit tests cover payload validation, authenticated ownership, upsert behavior, and reason handling.
- Frontend Playwright covers visible controls, changing a vote, downvote reason submission, and no controls on user/error messages.
- Existing assistant source/link and RAG audit tests must remain green.

## Privacy and safety

- Feedback is private to the authenticated user and is not exposed through public endpoints.
- Stored answer/context is bounded and treated as user-generated content.
- Feedback is an evaluation signal, not an instruction to the assistant and not an automatic knowledge-base update.
