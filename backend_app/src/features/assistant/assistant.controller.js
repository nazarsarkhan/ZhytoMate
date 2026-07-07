import { runAssistantQuery } from "./assistant.service.js";

export async function query(req, res, next) {
  try {
    const { userQuery, district, conversationId } = req.body;
    const result = await runAssistantQuery({ userId: req.user.id, userQuery, district, conversationId });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  query,
};
