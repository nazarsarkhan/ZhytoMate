import Conversation from "./conversation.model.js";

export function findConversationsByUser(userId) {
  return Conversation.find({ user: userId }).sort({ lastMessageAt: -1 });
}

// Filters by user in the query itself (not fetch-then-compare) so a foreign conversationId and a
// genuinely missing one are indistinguishable to the caller - both just return null.
export function findConversationByIdAndUser(id, userId) {
  return Conversation.findOne({ _id: id, user: userId });
}

export function createEmptyConversation({ userId, title }) {
  return Conversation.create({ user: userId, title, messages: [], lastMessageAt: new Date() });
}

export function setPendingAction(conversation, pendingAction) {
  conversation.pendingAction = pendingAction;
  return conversation.save();
}

export function clearPendingAction(conversation) {
  conversation.pendingAction = null;
  return conversation.save();
}

export function appendAssistantMessage(conversation, { text, actionCard = null }) {
  conversation.messages.push({ role: "assistant", text, actionCard });
  conversation.lastMessageAt = new Date();
  return conversation.save();
}

export function appendUserMessage(conversation, { text }) {
  conversation.messages.push({ role: "user", text });
  conversation.lastMessageAt = new Date();
  return conversation.save();
}

export default {
  findConversationsByUser,
  findConversationByIdAndUser,
  createEmptyConversation,
  setPendingAction,
  clearPendingAction,
  appendAssistantMessage,
  appendUserMessage,
};
