import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  createAppeal,
  getAppealById,
  getMyAppeals,
} from "./appeal.controller.js";
import {
  appealIdParamsSchema,
  createAppealSchema,
} from "./appeal.schema.js";

const router = Router();

router.post("/", authenticate, validate(createAppealSchema), createAppeal);
router.get("/me", authenticate, getMyAppeals);
router.get(
  "/:id",
  authenticate,
  validate(appealIdParamsSchema, "params"),
  getAppealById,
);

export default router;
