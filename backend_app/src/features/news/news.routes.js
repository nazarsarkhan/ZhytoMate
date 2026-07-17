import { Router } from "express";
import { validate, validateQuery } from "../../shared/validate.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import { requireInternalToken } from "../../middleware/internalAuth.js";
import {
  deleteNews,
  getAdminNews,
  getNews,
  getNewsItemById,
  ingestNews,
  updateNews,
} from "./news.controller.js";
import {
  adminNewsListQuerySchema,
  ingestNewsSchema,
  newsIdParamsSchema,
  updateNewsSchema,
} from "./news.schema.js";

const router = Router();

// Service-to-service ingest from the parser/ collector, guarded by the shared INTERNAL_TOKEN.
router.post("/ingest", requireInternalToken, validate(ingestNewsSchema), ingestNews);

// Admin management.
router.get(
  "/admin",
  authenticate,
  authorize("admin"),
  validateQuery(adminNewsListQuerySchema),
  getAdminNews,
);
router.patch(
  "/admin/:id",
  authenticate,
  authorize("admin"),
  validate(newsIdParamsSchema, "params"),
  validate(updateNewsSchema),
  updateNews,
);
router.delete(
  "/admin/:id",
  authenticate,
  authorize("admin"),
  validate(newsIdParamsSchema, "params"),
  deleteNews,
);

// Read endpoints for the app, JWT-protected like every other user-facing endpoint.
router.get("/", authenticate, getNews);
router.get(
  "/:id",
  authenticate,
  validate(newsIdParamsSchema, "params"),
  getNewsItemById,
);

export default router;
