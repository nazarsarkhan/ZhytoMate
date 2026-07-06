import { getConversationForUser, getConversationsForUser } from "./conversation.service.js";

export async function listConversations(req, res, next) {
  try {
    const conversations = await getConversationsForUser(req.user.id);
    return res.json({ conversations });
  } catch (err) {
    return next(err);
  }
}

export async function getConversation(req, res, next) {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user.id);
    return res.json({ conversation });
  } catch (err) {
    return next(err);
  }
}

export default {
  listConversations,
  getConversation,
};
