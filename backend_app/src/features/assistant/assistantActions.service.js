import { ApiError } from "../../shared/ApiError.js";
import { getAction } from "./actions/actionRegistry.js";
import {
  appendAssistantMessage,
  clearPendingAction,
  findConversationByIdAndUser,
  setPendingAction,
} from "../conversation/conversation.repository.js";

const ACTION_PUBLISHED_MESSAGE = "Готово! Звернення опубліковано.";
const ACTION_CANCELLED_MESSAGE = "Гаразд, скасовано.";
const EXECUTE_FAILED_MESSAGE = "Не вдалося опублікувати. Спробуйте підтвердити ще раз.";

async function loadOwnedConversation(conversationId, userId) {
  const conversation = await findConversationByIdAndUser(conversationId, userId);
  if (!conversation) {
    throw ApiError.notFound("Conversation not found");
  }
  return conversation;
}

function findInvalidEnumFields(action, slots) {
  return action.slotSchema.filter(
    (field) => field.enumValues && !field.enumValues.includes(slots[field.name]),
  );
}

// ml-service's slot-extraction endpoint is generic/domain-agnostic - it has no idea e.g.
// `category` must be one of APPEAL_CATEGORIES, so nothing upstream enforces this before
// execute() runs. A malformed/out-of-enum extraction reaching here shouldn't 500 or silently
// publish garbage: revert to "collecting" and name exactly what needs correcting. The user's next
// chat message goes through the normal extraction flow, which already overwrites slots on
// new-value-wins-collision, so there's nothing else to clear here.
async function reviseInvalidSlots(conversation, invalidFields) {
  await setPendingAction(conversation, { ...conversation.pendingAction, status: "collecting" });
  const asks = invalidFields
    .map((field) => `${field.description} (${field.enumValues.join(", ")})`)
    .join("; ");
  const text = `Уточніть, будь ласка: ${asks}.`;
  await appendAssistantMessage(conversation, { text });
  return { answer: text };
}

export async function confirmPendingAction({ conversationId, userId }) {
  const conversation = await loadOwnedConversation(conversationId, userId);
  if (!conversation.pendingAction || conversation.pendingAction.status !== "confirming") {
    throw ApiError.badRequest("No action awaiting confirmation");
  }

  const action = getAction(conversation.pendingAction.type);
  if (!action) {
    throw ApiError.badGateway("Unknown action type");
  }

  const invalidFields = findInvalidEnumFields(action, conversation.pendingAction.slots);
  if (invalidFields.length > 0) {
    return reviseInvalidSlots(conversation, invalidFields);
  }

  let created;
  try {
    created = await action.execute(conversation.pendingAction.slots, userId);
  } catch (err) {
    // Leave pendingAction as "confirming" so the user can retry Confirm without re-entering
    // anything they already provided.
    console.error("[assistant-actions] execute failed", err);
    throw new ApiError(500, EXECUTE_FAILED_MESSAGE);
  }

  await clearPendingAction(conversation);
  await appendAssistantMessage(conversation, { text: ACTION_PUBLISHED_MESSAGE });
  return { answer: ACTION_PUBLISHED_MESSAGE, created };
}

export async function cancelPendingAction({ conversationId, userId }) {
  const conversation = await loadOwnedConversation(conversationId, userId);
  if (!conversation.pendingAction) {
    throw ApiError.badRequest("No action in progress");
  }

  await clearPendingAction(conversation);
  await appendAssistantMessage(conversation, { text: ACTION_CANCELLED_MESSAGE });
  return { answer: ACTION_CANCELLED_MESSAGE };
}

export default { confirmPendingAction, cancelPendingAction };
