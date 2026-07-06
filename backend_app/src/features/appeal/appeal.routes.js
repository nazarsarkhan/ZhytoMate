import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  createAppeal,
  getAppealById,
  getMyAppeals,
  uploadPhoto,
} from "./appeal.controller.js";
import {
  appealIdParamsSchema,
  createAppealSchema,
} from "./appeal.schema.js";
import { uploadAppealPhoto } from "./appeal.upload.js";

const router = Router();

router.post("/", authenticate, validate(createAppealSchema), createAppeal);
router.post("/upload", authenticate, uploadAppealPhoto.single("photo"), uploadPhoto);
router.get("/me", authenticate, getMyAppeals);
router.get(
  "/:id",
  authenticate,
  validate(appealIdParamsSchema, "params"),
  getAppealById,
);

export default router;
