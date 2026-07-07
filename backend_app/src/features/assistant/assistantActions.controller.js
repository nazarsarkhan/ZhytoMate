import { cancelPendingAction, confirmPendingAction } from "./assistantActions.service.js";

export async function confirmAction(req, res, next) {
  try {
    const result = await confirmPendingAction({ conversationId: req.params.id, userId: req.user.id });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function cancelAction(req, res, next) {
  try {
    const result = await cancelPendingAction({ conversationId: req.params.id, userId: req.user.id });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default { confirmAction, cancelAction };
