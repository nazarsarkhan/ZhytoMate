import { ApiError } from "../../shared/ApiError.js";
import {
  deriveConversationTitle,
  toPublicConversation,
  toPublicConversationSummary,
} from "./conversation.model.js";
import {
  appendExchange,
  createConversation,
  findConversationByIdAndUser,
  findConversationsByUser,
} from "./conversation.repository.js";

export async function getConversationsForUser(userId) {
  const conversations = await findConversationsByUser(userId);
  return conversations.map(toPublicConversationSummary);
}

export async function getConversationForUser(id, userId) {
  const conversation = await findConversationByIdAndUser(id, userId);
  if (!conversation) {
    throw ApiError.notFound("Conversation not found");
  }

  return toPublicConversation(conversation);
}

// Appends to the given conversation if it exists and belongs to this user; otherwise silently
// starts a new one. A stale or foreign conversationId degrading to "start fresh" is more
// resilient than failing a request that already produced a real, good answer from the assistant.
export async function recordExchange({ userId, conversationId, userQuery, answer }) {
  if (conversationId) {
    const existing = await findConversationByIdAndUser(conversationId, userId);
    if (existing) {
      const updated = await appendExchange(existing, { userQuery, answer });
      return toPublicConversation(updated);
    }
  }

  const conversation = await createConversation({
    userId,
    title: deriveConversationTitle(userQuery),
    userQuery,
    answer,
  });
  return toPublicConversation(conversation);
}

export default {
  getConversationsForUser,
  getConversationForUser,
  recordExchange,
};
