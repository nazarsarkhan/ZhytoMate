import { upsertAssistantFeedback } from "./assistantFeedback.service.js";

export async function submitAssistantFeedback(req, res, next) {
  try {
    const feedback = await upsertAssistantFeedback({ userId: req.user.id, payload: req.body });
    return res.json({ feedback });
  } catch (error) {
    return next(error);
  }
}

export default { submitAssistantFeedback };
