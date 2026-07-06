import { recordExchange } from "../conversation/conversation.service.js";
import { askAssistant } from "./assistant.service.js";

export async function query(req, res, next) {
  try {
    const { userQuery, district, conversationId } = req.body;
    const result = await askAssistant({ userQuery, userId: req.user.id, district });

    // Orchestrating the RAG call and persistence is the controller's job, not a service's - a
    // service must not import another service directly. Persistence failures are logged and
    // swallowed rather than surfaced as a 500: the user already has a real, good answer, and a
    // Mongo hiccup shouldn't take that away from them.
    let persistedConversationId = null;
    try {
      const conversation = await recordExchange({
        userId: req.user.id,
        conversationId,
        userQuery,
        answer: result.answer,
      });
      persistedConversationId = conversation.id;
    } catch (err) {
      console.error("[assistant] failed to persist conversation exchange", err);
    }

    return res.json({ ...result, conversationId: persistedConversationId });
  } catch (err) {
    return next(err);
  }
}

export default {
  query,
};
