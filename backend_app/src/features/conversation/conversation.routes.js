import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import { getConversation, listConversations } from "./conversation.controller.js";
import { conversationIdParamsSchema } from "./conversation.schema.js";

const router = Router();

router.get("/", authenticate, listConversations);
router.get(
  "/:id",
  authenticate,
  validate(conversationIdParamsSchema, "params"),
  getConversation,
);

export default router;
