import { getAction, isRequiredSlotsFilled } from "./actions/actionRegistry.js";
import { extractActionSlots, queryAssistant as callAssistant } from "../../shared/mlClient.js";
import {
  appendAssistantMessage,
  appendUserMessage,
  clearPendingAction,
  createEmptyConversation,
  findConversationByIdAndUser,
  setPendingAction,
} from "../conversation/conversation.repository.js";
import { deriveConversationTitle } from "../conversation/conversation.model.js";

const UNABLE_TO_PROCESS_MESSAGE =
  "Вибачте, не вдалося обробити повідомлення. Спробуйте ще раз.";

// Loads the conversation this exchange belongs to, creating a fresh (empty) one if conversationId
// is missing, stale, or foreign - same resilience posture as the pre-existing
// conversation.service.recordExchange this replaces for the assistant-actions-aware flow. Uses
// createEmptyConversation (not the pre-existing createConversation, which always seeds a
// user+assistant message pair) since this flow appends every message itself, one at a time, as
// the state machine progresses.
async function loadOrCreateConversation({ userId, conversationId, userQuery }) {
  if (conversationId) {
    const existing = await findConversationByIdAndUser(conversationId, userId);
    if (existing) return existing;
  }
  return createEmptyConversation({ userId, title: deriveConversationTitle(userQuery) });
}

// No pending action yet: run the normal RAG query. If ml-service detected an action_intent,
// start collecting for it instead of just returning the RAG answer.
async function handleNoPendingAction({ conversation, userQuery, userId, district }) {
  const result = await callAssistant({ userQuery, userId, district });

  if (!result.actionIntent) {
    await appendAssistantMessage(conversation, { text: result.answer });
    return { answer: result.answer, sourcesUsed: result.sourcesUsed, confidence: result.confidence };
  }

  const action = getAction(result.actionIntent);
  if (!action) {
    // ml-service and the backend registry drifted out of sync (see actionRegistry.js's comment) -
    // fall back to answering normally rather than starting a flow for an action that doesn't
    // exist here.
    await appendAssistantMessage(conversation, { text: result.answer });
    return { answer: result.answer, sourcesUsed: result.sourcesUsed, confidence: result.confidence };
  }

  let extraction;
  try {
    extraction = await extractActionSlots({
      message: userQuery,
      slotSchema: action.slotSchema,
      currentSlots: {},
    });
  } catch (err) {
    // No draft exists yet at this point, so there's nothing to leave untouched - just tell the
    // user to try again rather than starting a draft from a failed extraction.
    console.error("[assistant-actions] slot extraction failed", err);
    await appendAssistantMessage(conversation, { text: UNABLE_TO_PROCESS_MESSAGE });
    return { answer: UNABLE_TO_PROCESS_MESSAGE, sourcesUsed: [], confidence: 0 };
  }
  await setPendingAction(conversation, {
    type: action.type,
    status: "collecting",
    slots: extraction.slots,
  });
  const missing = action.requiredSlots.filter((name) => !extraction.slots[name]);
  const reply = `Гаразд, оформлюємо звернення. ${
    missing.length > 0 ? `Розкажіть детальніше: ${missing.join(", ")}.` : ""
  }`.trim();
  await appendAssistantMessage(conversation, { text: reply });
  return { answer: reply, sourcesUsed: [], confidence: 0 };
}

// A pending action is already open: feed this message to slot extraction rather than treating it
// as a fresh query. An unrelated message still gets a normal RAG answer, but the draft is left
// untouched so the user can return to it later (see the spec's "Interruption case").
async function handlePendingAction({ conversation, userQuery, userId, district }) {
  const { pendingAction } = conversation;
  const action = getAction(pendingAction.type);
  if (!action) {
    await clearPendingAction(conversation);
    const reply = UNABLE_TO_PROCESS_MESSAGE;
    await appendAssistantMessage(conversation, { text: reply });
    return { answer: reply, sourcesUsed: [], confidence: 0 };
  }

  let extraction;
  try {
    extraction = await extractActionSlots({
      message: userQuery,
      slotSchema: action.slotSchema,
      currentSlots: pendingAction.slots,
    });
  } catch (err) {
    // Deliberately do NOT call setPendingAction/clearPendingAction here - the existing draft
    // (already persisted from a prior turn) must be left exactly as it was, per the design
    // spec's error-handling section.
    console.error("[assistant-actions] slot extraction failed", err);
    await appendAssistantMessage(conversation, { text: UNABLE_TO_PROCESS_MESSAGE });
    return { answer: UNABLE_TO_PROCESS_MESSAGE, sourcesUsed: [], confidence: 0 };
  }

  if (extraction.wantsCancel) {
    await clearPendingAction(conversation);
    const reply = "Гаразд, скасовано.";
    await appendAssistantMessage(conversation, { text: reply });
    return { answer: reply, sourcesUsed: [], confidence: 0 };
  }

  if (extraction.isUnrelated) {
    const result = await callAssistant({ userQuery, userId, district });
    await appendAssistantMessage(conversation, { text: result.answer });
    return { answer: result.answer, sourcesUsed: result.sourcesUsed, confidence: result.confidence };
  }

  if (isRequiredSlotsFilled(action, extraction.slots)) {
    await setPendingAction(conversation, {
      type: action.type,
      status: "confirming",
      slots: extraction.slots,
    });
    const summary = action.describeSummary(extraction.slots);
    const text = `Перевірте деталі перед публікацією:\n${summary}`;
    const actionCard = { type: action.type, summary, slots: extraction.slots };
    await appendAssistantMessage(conversation, { text, actionCard });
    return { answer: text, sourcesUsed: [], confidence: 0, actionCard };
  }

  await setPendingAction(conversation, {
    type: action.type,
    status: "collecting",
    slots: extraction.slots,
  });
  const missing = action.requiredSlots.filter((name) => !extraction.slots[name]);
  const reply = `Дякую. Ще потрібно: ${missing.join(", ")}.`;
  await appendAssistantMessage(conversation, { text: reply });
  return { answer: reply, sourcesUsed: [], confidence: 0 };
}

export async function query(req, res, next) {
  try {
    const { userQuery, district, conversationId } = req.body;
    const conversation = await loadOrCreateConversation({
      userId: req.user.id,
      conversationId,
      userQuery,
    });
    await appendUserMessage(conversation, { text: userQuery });

    const result = conversation.pendingAction
      ? await handlePendingAction({ conversation, userQuery, userId: req.user.id, district })
      : await handleNoPendingAction({ conversation, userQuery, userId: req.user.id, district });

    return res.json({ ...result, conversationId: conversation._id.toString() });
  } catch (err) {
    return next(err);
  }
}

export default {
  query,
};
