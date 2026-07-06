import Conversation from "./conversation.model.js";

export function findConversationsByUser(userId) {
  return Conversation.find({ user: userId }).sort({ lastMessageAt: -1 });
}

// Filters by user in the query itself (not fetch-then-compare) so a foreign conversationId and a
// genuinely missing one are indistinguishable to the caller - both just return null.
export function findConversationByIdAndUser(id, userId) {
  return Conversation.findOne({ _id: id, user: userId });
}

export function createConversation({ userId, title, userQuery, answer }) {
  return Conversation.create({
    user: userId,
    title,
    messages: [
      { role: "user", text: userQuery },
      { role: "assistant", text: answer },
    ],
    lastMessageAt: new Date(),
  });
}

export function appendExchange(conversation, { userQuery, answer }) {
  conversation.messages.push({ role: "user", text: userQuery });
  conversation.messages.push({ role: "assistant", text: answer });
  conversation.lastMessageAt = new Date();
  return conversation.save();
}

export default {
  findConversationsByUser,
  findConversationByIdAndUser,
  createConversation,
  appendExchange,
};
