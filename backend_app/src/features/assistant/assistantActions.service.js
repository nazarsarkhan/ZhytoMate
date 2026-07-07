// Confirm/Cancel are discrete button-click endpoints, not chat turns. assistant.service.js always
// resolves to 200 with a natural-language reply (a raw HTTP error would break a mid-conversation
// turn), but these two deliberately throw real ApiErrors instead - the frontend's button handlers
// branch on actual HTTP status here. This is an intentional convention difference, not oversight.
import { ApiError } from "../../shared/ApiError.js";
import { getAction } from "./actions/actionRegistry.js";
import {
  appendAssistantMessage,
  claimAnyPendingAction,
  claimPendingActionByStatus,
  findConversationByIdAndUser,
  restorePendingAction,
} from "../conversation/conversation.repository.js";

const ACTION_CANCELLED_MESSAGE = "Гаразд, скасовано.";
// Registry drift between ml-service and this backend's actionRegistry (see its own comment) isn't
// something retrying Confirm can fix, so this mirrors handlePendingAction's identical scenario in
// assistant.service.js: a friendly reply, not a raw error.
const UNKNOWN_ACTION_MESSAGE = "Вибачте, не вдалося обробити цю дію. Спробуйте ще раз.";
// Used only if an action module omits its own successMessage/failureMessage - see
// createAppeal.action.js for the per-action wording this normally comes from.
const DEFAULT_SUCCESS_MESSAGE = "Готово! Дію виконано.";
const DEFAULT_FAILURE_MESSAGE = "Не вдалося виконати дію. Спробуйте підтвердити ще раз.";

async function loadOwnedConversation(conversationId, userId) {
  const conversation = await findConversationByIdAndUser(conversationId, userId);
  if (!conversation) {
    throw ApiError.notFound("Conversation not found");
  }
  return conversation;
}

// The atomic claim functions (conversation.repository.js) return null when nothing matched their
// filter - which is either "no such conversation" or "conversation exists but had nothing
// claimable" (wrong status, already claimed by a concurrent request, etc). This cheap follow-up
// lookup - only ever hit on this failure path, never the hot path - tells the two apart so the
// existing 404-vs-400 distinction survives the switch to an atomic claim.
async function ensureClaimed(claimed, conversationId, userId, notClaimedMessage) {
  if (claimed) return;
  await loadOwnedConversation(conversationId, userId);
  throw ApiError.badRequest(notClaimedMessage);
}

// The claimed document is a pre-update Mongoose snapshot (see claimPendingActionByStatus's
// comment). Reading these three fields off it directly (rather than spreading the subdocument) and
// building a plain object is the explicit, unambiguous way to carry its data forward - this plain
// object is what later gets handed to restorePendingAction if the draft needs reverting.
function extractPendingAction(claimedConversation) {
  const { type, status, slots } = claimedConversation.pendingAction;
  return { type, status, slots };
}

function findInvalidFields(action, slots) {
  return action.slotSchema.filter((field) => {
    const value = slots[field.name];
    if (field.enumValues && !field.enumValues.includes(value)) return true;
    if (field.minLength !== undefined && (typeof value !== "string" || value.length < field.minLength)) return true;
    if (field.maxLength !== undefined && typeof value === "string" && value.length > field.maxLength) return true;
    return false;
  });
}

// ml-service's slot-extraction endpoint is generic/domain-agnostic - it has no idea e.g.
// `category` must be one of APPEAL_CATEGORIES or that `description`/`address` have length
// bounds, so nothing upstream enforces this before execute() runs. A malformed/out-of-enum or
// too-short/too-long extraction reaching here shouldn't 500 or silently publish garbage: restore
// the draft to "collecting" and name exactly what needs correcting. The user's next chat message
// goes through the normal extraction flow, which already overwrites slots on new-value-wins-
// collision, so there's nothing else to clear here.
async function reviseInvalidSlots(conversationId, userId, pendingAction, invalidFields) {
  await restorePendingAction(conversationId, { ...pendingAction, status: "collecting" });

  const asks = invalidFields
    .map((field) => (field.enumValues ? `${field.description} (${field.enumValues.join(", ")})` : field.description))
    .join("; ");
  const text = `Уточніть, будь ласка: ${asks}.`;

  const conversation = await loadOwnedConversation(conversationId, userId);
  await appendAssistantMessage(conversation, { text });
  return { answer: text };
}

export async function confirmPendingAction({ conversationId, userId }) {
  const claimed = await claimPendingActionByStatus(conversationId, userId, "confirming");
  await ensureClaimed(claimed, conversationId, userId, "No action awaiting confirmation");
  const pendingAction = extractPendingAction(claimed);

  const action = getAction(pendingAction.type);
  if (!action) {
    const conversation = await loadOwnedConversation(conversationId, userId);
    await appendAssistantMessage(conversation, { text: UNKNOWN_ACTION_MESSAGE });
    return { answer: UNKNOWN_ACTION_MESSAGE };
  }

  const invalidFields = findInvalidFields(action, pendingAction.slots);
  if (invalidFields.length > 0) {
    return reviseInvalidSlots(conversationId, userId, pendingAction, invalidFields);
  }

  const successMessage = action.successMessage ?? DEFAULT_SUCCESS_MESSAGE;
  const failureMessage = action.failureMessage ?? DEFAULT_FAILURE_MESSAGE;

  let created;
  try {
    created = await action.execute(pendingAction.slots, userId);
  } catch (err) {
    // Restore (not clear) pendingAction so the user can retry Confirm without re-entering
    // anything they already provided - execute() failures are expected to often be transient.
    console.error("[assistant-actions] execute failed", err);
    await restorePendingAction(conversationId, pendingAction);
    const conversation = await loadOwnedConversation(conversationId, userId);
    await appendAssistantMessage(conversation, { text: failureMessage });
    throw new ApiError(500, failureMessage);
  }

  const conversation = await loadOwnedConversation(conversationId, userId);
  await appendAssistantMessage(conversation, { text: successMessage });
  return { answer: successMessage, created };
}

export async function cancelPendingAction({ conversationId, userId }) {
  const claimed = await claimAnyPendingAction(conversationId, userId);
  await ensureClaimed(claimed, conversationId, userId, "No action in progress");

  const conversation = await loadOwnedConversation(conversationId, userId);
  await appendAssistantMessage(conversation, { text: ACTION_CANCELLED_MESSAGE });
  return { answer: ACTION_CANCELLED_MESSAGE };
}

export default { confirmPendingAction, cancelPendingAction };
