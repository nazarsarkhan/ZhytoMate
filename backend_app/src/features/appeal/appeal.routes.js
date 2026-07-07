import { Router } from "express";
import { validate, validateQuery } from "../../shared/validate.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  createAppeal,
  getAppealById,
  getAppeals,
  getMyAppeals,
  updateAppeal,
  uploadPhoto,
} from "./appeal.controller.js";
import {
  appealIdParamsSchema,
  createAppealSchema,
  listAppealsQuerySchema,
  updateAppealSchema,
} from "./appeal.schema.js";
import { uploadAppealPhoto } from "./appeal.upload.js";

const router = Router();

router.post("/", authenticate, validate(createAppealSchema), createAppeal);
router.post("/upload", authenticate, uploadAppealPhoto.single("photo"), uploadPhoto);
router.get("/me", authenticate, getMyAppeals);

// Admin: list all appeals (filters via query) and respond / change status.
router.get(
  "/",
  authenticate,
  authorize("admin"),
  validateQuery(listAppealsQuerySchema),
  getAppeals,
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(appealIdParamsSchema, "params"),
  validate(updateAppealSchema),
  updateAppeal,
);

router.get(
  "/:id",
  authenticate,
  validate(appealIdParamsSchema, "params"),
  getAppealById,
);

export default router;
