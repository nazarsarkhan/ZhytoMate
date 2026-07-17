import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import { query } from "./assistant.controller.js";
import { submitAssistantFeedback } from "./assistantFeedback.controller.js";
import { cancelAction, confirmAction } from "./assistantActions.controller.js";
import { assistantQuerySchema } from "./assistant.schema.js";
import assistantFeedbackSchema from "./assistantFeedback.schema.js";
import { conversationIdParamsSchema } from "../conversation/conversation.schema.js";

const router = Router();

router.post("/query", authenticate, validate(assistantQuerySchema), query);
router.post("/feedback", authenticate, validate(assistantFeedbackSchema), submitAssistantFeedback);
router.post(
  "/conversations/:id/actions/confirm",
  authenticate,
  validate(conversationIdParamsSchema, "params"),
  confirmAction,
);
router.post(
  "/conversations/:id/actions/cancel",
  authenticate,
  validate(conversationIdParamsSchema, "params"),
  cancelAction,
);

export default router;
