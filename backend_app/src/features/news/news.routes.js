import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import { requireInternalToken } from "../../middleware/internalAuth.js";
import {
  getNews,
  getNewsItemById,
  ingestNews,
} from "./news.controller.js";
import { ingestNewsSchema, newsIdParamsSchema } from "./news.schema.js";

const router = Router();

// Service-to-service ingest from the parser/ collector, guarded by the shared INTERNAL_TOKEN.
router.post("/ingest", requireInternalToken, validate(ingestNewsSchema), ingestNews);

// Read endpoints for the app, JWT-protected like every other user-facing endpoint.
router.get("/", authenticate, getNews);
router.get(
  "/:id",
  authenticate,
  validate(newsIdParamsSchema, "params"),
  getNewsItemById,
);

export default router;
