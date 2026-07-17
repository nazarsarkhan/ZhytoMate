import mongoose from "mongoose";
import { ApiError } from "../../shared/ApiError.js";
import { Conversation } from "../conversation/conversation.model.js";
import { AssistantFeedback } from "./assistantFeedback.model.js";

function asObjectId(value, field) {
  if (!mongoose.isValidObjectId(value)) throw ApiError.badRequest(`Invalid ${field}`);
  return new mongoose.Types.ObjectId(value);
}

function capArray(values, limit) {
  return Array.isArray(values) ? values.slice(0, limit) : [];
}

export async function upsertAssistantFeedback({ userId, payload }) {
  const messageId = asObjectId(payload.messageId, "messageId");
  const filter = { user: userId, "messages._id": messageId };
  if (payload.conversationId) filter._id = asObjectId(payload.conversationId, "conversationId");

  const conversation = await Conversation.findOne(filter);
  const message = conversation?.messages?.id(messageId);
  if (!conversation || !message || message.role !== "assistant" || message.actionCard) {
    throw ApiError.notFound("Assistant message not found");
  }

  const normalized = {
    userId,
    messageId,
    conversationId: conversation._id,
    userQuery: String(payload.userQuery || "").slice(0, 1000),
    // The persisted message is authoritative; the client copy is only used for diagnostics.
    answer: message.text.slice(0, 12000),
    vote: payload.vote,
    reason: payload.vote === "down" ? (payload.reason || null) : null,
    answerStatus: String(payload.answerStatus || "").slice(0, 40),
    verified: payload.verified === true,
    sourcesUsed: capArray(payload.sourcesUsed, 20),
    appLinks: capArray(payload.appLinks, 10),
  };

  const feedback = await AssistantFeedback.findOneAndUpdate(
    { userId, messageId },
    { $set: normalized },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return {
    id: feedback._id.toString(),
    messageId: feedback.messageId.toString(),
    conversationId: feedback.conversationId.toString(),
    vote: feedback.vote,
    reason: feedback.reason,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}

export default { upsertAssistantFeedback };
