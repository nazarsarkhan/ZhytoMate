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

// Atomically clears pendingAction, but only when it currently has the given status - the read
// (filter) and the write happen as one operation, so two concurrent callers (a double-tap Confirm,
// or a client retry racing the original request) can't both observe "confirming" and both act on
// it: only the first write's filter still matches, since the loser's findOneAndUpdate runs against
// a document that already has pendingAction: null. Same shape as survey.repository.js's
// upsertSurveyVote, which uses findOneAndUpdate for the same read-then-write-must-be-atomic reason.
//
// Returns the document as it stood BEFORE this update (returnDocument: "before", explicit rather
// than relying on the driver default) so the caller still has the claimed pendingAction's
// type/slots to act on. That returned document is a snapshot only - it must never be mutated and
// .save()'d afterward, since Mongoose would re-persist its now-stale in-memory pendingAction and
// resurrect what this update just cleared. Always re-fetch fresh (findConversationByIdAndUser)
// before appending a message or saving anything else on the same conversation.
export function claimPendingActionByStatus(conversationId, userId, status) {
  return Conversation.findOneAndUpdate(
    { _id: conversationId, user: userId, "pendingAction.status": status },
    { $set: { pendingAction: null } },
    { returnDocument: "before" },
  );
}

// Same atomic-claim shape as claimPendingActionByStatus, but for cancel: any non-null pendingAction
// qualifies regardless of status ("collecting" or "confirming") - cancelling is valid at any point
// in the flow, not just once a draft reaches "confirming".
export function claimAnyPendingAction(conversationId, userId) {
  return Conversation.findOneAndUpdate(
    { _id: conversationId, user: userId, pendingAction: { $ne: null } },
    { $set: { pendingAction: null } },
    { returnDocument: "before" },
  );
}

// Restores pendingAction via a direct atomic write (not load-then-save) - used after a claimed
// action turns out to need reverting (execute() failed, or slots failed enum validation). Same
// staleness reasoning as claimPendingActionByStatus's comment: restoring by mutating and saving an
// old in-memory document would risk clobbering whatever else changed on the conversation since it
// was loaded.
export function restorePendingAction(conversationId, pendingAction) {
  return Conversation.findByIdAndUpdate(conversationId, { $set: { pendingAction } });
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
  claimPendingActionByStatus,
  claimAnyPendingAction,
  restorePendingAction,
  appendAssistantMessage,
  appendUserMessage,
};
