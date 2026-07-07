import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  createSurvey,
  deleteSurvey,
  getProgress,
  getSurveyById,
  getSurveys,
  updateSurvey,
  voteSurvey,
} from "./survey.controller.js";
import {
  createSurveySchema,
  surveyIdParamsSchema,
  updateSurveySchema,
  voteSurveySchema,
} from "./survey.schema.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createSurveySchema),
  createSurvey,
);
router.get("/", authenticate, getSurveys);
router.get("/progress", authenticate, getProgress);
router.get(
  "/:id",
  authenticate,
  validate(surveyIdParamsSchema, "params"),
  getSurveyById,
);
router.post(
  "/:id/vote",
  authenticate,
  validate(surveyIdParamsSchema, "params"),
  validate(voteSurveySchema),
  voteSurvey,
);

// Admin: edit / close / reopen and delete surveys.
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(surveyIdParamsSchema, "params"),
  validate(updateSurveySchema),
  updateSurvey,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(surveyIdParamsSchema, "params"),
  deleteSurvey,
);

export default router;
