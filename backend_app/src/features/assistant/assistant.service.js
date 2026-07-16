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
import { searchPlaces } from "../places/places.repository.js";
import { detectPlaceQuery, detectTransportRouteQuery, formatPlaceAnswer } from "../places/places-assistant.js";
import { listNews } from "../news/news.service.js";
import { detectLatestNewsQuery, formatLatestNewsAnswer } from "../news/news-assistant.js";

const UNABLE_TO_PROCESS_MESSAGE =
  "Вибачте, не вдалося обробити повідомлення. Спробуйте ще раз.";

// Loads the conversation this exchange belongs to, creating a fresh (empty) one if conversationId
// is missing, stale, or foreign - same resilience posture as the pre-existing (now-deleted)
// conversation.service.recordExchange this replaces for the assistant-actions-aware flow. Uses
// createEmptyConversation (not the old createConversation, which always seeded a user+assistant
// message pair) since this flow appends every message itself, one at a time, as the state machine
// progresses.
async function loadOrCreateConversation({ userId, conversationId, userQuery }) {
  if (conversationId) {
    const existing = await findConversationByIdAndUser(conversationId, userId);
    if (existing) return existing;
  }
  return createEmptyConversation({ userId, title: deriveConversationTitle(userQuery) });
}

// Renders the still-missing required slots using their human-readable schema descriptions (e.g.
// "Адреса або місце розташування проблеми") rather than raw field names (e.g. "address"), so the
// reply reads as natural Ukrainian instead of leaking internal slot keys.
function describeMissingSlots(action, slots) {
  return action.requiredSlots
    .filter((name) => !slots[name])
    .map((name) => action.slotSchema.find((field) => field.name === name)?.description ?? name)
    .join(", ");
}

// Shared by both handlers once slot extraction succeeds: either the draft is now fully filled
// (flip to "confirming" and render an action card) or it isn't (stay "collecting" and ask for
// what's left). This runs identically whether the triggering message was the opening turn (an
// action_intent just detected, no prior draft) or a follow-up turn on an already-open draft - a
// single message can complete every required slot in one shot in either case, so both callers
// must check completeness the same way rather than the opening turn unconditionally assuming
// "collecting". isOpeningTurn only changes the collecting-state reply's wording.
async function resolveDraftState({ conversation, action, extraction, isOpeningTurn }) {
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
  const missing = describeMissingSlots(action, extraction.slots);
  const reply = isOpeningTurn
    ? `Гаразд, оформлюємо звернення. Розкажіть детальніше: ${missing}.`
    : `Дякую. Ще потрібно: ${missing}.`;
  await appendAssistantMessage(conversation, { text: reply });
  return { answer: reply, sourcesUsed: [], confidence: 0 };
}

// No pending action yet: run the normal RAG query. If ml-service detected an action_intent,
// start collecting for it instead of just returning the RAG answer - and if the triggering
// message alone already contains every required slot, resolveDraftState takes the confirming
// branch immediately rather than forcing an unnecessary extra "collecting" turn.
async function handleNoPendingAction({ conversation, userQuery, userId, district }) {
  if (detectLatestNewsQuery(userQuery)) {
    // The city-council crawler also stores navigation/instruction pages in the News collection.
    // They are useful for RAG, but must not be presented as "latest news" headlines.
    const news = await listNews({ source: "zhytomir-info", limit: 5 });
    const answer = formatLatestNewsAnswer(news);
    if (answer) {
      await appendAssistantMessage(conversation, { text: answer });
      return {
        answer,
        sourcesUsed: news.map((item) => item.sourceUrl).filter(Boolean),
        confidence: 0.95,
        grounded: true,
        verified: true,
        answerStatus: "grounded",
        appLinks: [{ capability: "news", label: "Новини", route: "/news", reason: "Переглянути новини Житомира" }],
      };
    }
  }
  if (detectTransportRouteQuery(userQuery)) {
    const result = await callAssistant({ userQuery, userId, district });
    await appendAssistantMessage(conversation, { text: result.answer });
    return {
      answer: result.answer,
      sourcesUsed: result.sourcesUsed,
      confidence: result.confidence,
      grounded: result.grounded,
      verified: result.verified,
      answerStatus: result.answerStatus,
      appLinks: result.appLinks,
    };
  }
  const placeIntent = detectPlaceQuery(userQuery);
  if (placeIntent) {
    const catalog = await searchPlaces({ category: placeIntent.category, limit: 10, offset: 0, radius_m: 5000 });
    const answer = formatPlaceAnswer(catalog.items);
    if (answer) {
      await appendAssistantMessage(conversation, { text: answer });
      return {
        answer,
        sourcesUsed: catalog.items.slice(0, 10).map((item) => item.sourceUrl),
        confidence: 0.9,
        grounded: true,
        verified: true,
        answerStatus: "grounded",
        appLinks: [{ capability: "places", label: "Місця", route: "/places", reason: "Знайти потрібні місця у Житомирі" }],
      };
    }
  }
  const result = await callAssistant({ userQuery, userId, district });

  if (!result.actionIntent) {
    await appendAssistantMessage(conversation, { text: result.answer });
    return {
      answer: result.answer,
      sourcesUsed: result.sourcesUsed,
      confidence: result.confidence,
      grounded: result.grounded,
      verified: result.verified,
      answerStatus: result.answerStatus,
      appLinks: result.appLinks,
    };
  }

  const action = getAction(result.actionIntent);
  if (!action) {
    // ml-service and the backend registry drifted out of sync (see actionRegistry.js's comment) -
    // fall back to answering normally rather than starting a flow for an action that doesn't
    // exist here.
    await appendAssistantMessage(conversation, { text: result.answer });
    return {
      answer: result.answer,
      sourcesUsed: result.sourcesUsed,
      confidence: result.confidence,
      grounded: result.grounded,
      verified: result.verified,
      answerStatus: result.answerStatus,
      appLinks: result.appLinks,
    };
  }

  let extraction;
  try {
    // Deliberately NOT OPSEC-gated: this extracts structured fields for the user's own appeal, it
    // is never reflected back as a generated answer or used for KB retrieval, so there's no
    // cross-user leak vector - conceptually the same trust level as filling out a plain web form.
    // Gating it would also false-positive on legitimate reports near sensitive locations (e.g.
    // "яма біля блокпосту"), the exact over-blocking failure mode the OPSEC heuristic itself was
    // fixed to avoid on 2026-07-06.
    extraction = await extractActionSlots({
      message: userQuery,
      slotSchema: action.slotSchema,
      currentSlots: {},
    });
  } catch (err) {
    // The RAG call above already succeeded - result.answer is a real, already-generated answer to
    // the user's message. Only this bonus slot-extraction enrichment failed, so fall back to that
    // real answer instead of discarding it for a generic apology; the message WAS processed.
    console.error("[assistant-actions] slot extraction failed, falling back to plain answer", err);
    await appendAssistantMessage(conversation, { text: result.answer });
    return {
      answer: result.answer,
      sourcesUsed: result.sourcesUsed,
      confidence: result.confidence,
      grounded: result.grounded,
      verified: result.verified,
      answerStatus: result.answerStatus,
      appLinks: result.appLinks,
    };
  }

  return resolveDraftState({ conversation, action, extraction, isOpeningTurn: true });
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
    // Deliberately not OPSEC-gated - see the identical note in handleNoPendingAction.
    extraction = await extractActionSlots({
      message: userQuery,
      slotSchema: action.slotSchema,
      currentSlots: pendingAction.slots,
    });
  } catch (err) {
    // Deliberately do NOT call setPendingAction/clearPendingAction here - the existing draft
    // (already persisted from a prior turn) must be left exactly as it was, per the design
    // spec's error-handling section. Unlike handleNoPendingAction, there is no prior successful
    // call this turn to fall back to, so the generic apology is the correct reply here.
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
    return {
      answer: result.answer,
      sourcesUsed: result.sourcesUsed,
      confidence: result.confidence,
      grounded: result.grounded,
      verified: result.verified,
      answerStatus: result.answerStatus,
      appLinks: result.appLinks,
    };
  }

  return resolveDraftState({ conversation, action, extraction, isOpeningTurn: false });
}

// Single entry point for POST /assistant/query - the whole action-intent-detection and
// slot-collection state machine lives here (service layer), not in the controller. The controller
// only translates the HTTP request into this call and the result into a JSON response.
export async function runAssistantQuery({ userId, userQuery, district, conversationId }) {
  const conversation = await loadOrCreateConversation({ userId, conversationId, userQuery });
  await appendUserMessage(conversation, { text: userQuery });

  const result = conversation.pendingAction
    ? await handlePendingAction({ conversation, userQuery, userId, district })
    : await handleNoPendingAction({ conversation, userQuery, userId, district });

  return { ...result, conversationId: conversation._id.toString() };
}

export default {
  runAssistantQuery,
};
