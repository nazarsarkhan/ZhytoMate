import { ApiError } from "../../shared/ApiError.js";
import { toPublicConversation, toPublicConversationSummary } from "./conversation.model.js";
import { findConversationByIdAndUser, findConversationsByUser } from "./conversation.repository.js";

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

export default {
  getConversationsForUser,
  getConversationForUser,
};
