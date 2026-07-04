import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  createSurvey,
  getProgress,
  getSurveyById,
  getSurveys,
  voteSurvey,
} from "./survey.controller.js";
import {
  createSurveySchema,
  surveyIdParamsSchema,
  voteSurveySchema,
} from "./survey.schema.js";

const router = Router();

router.post("/", authenticate, validate(createSurveySchema), createSurvey);
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

export default router;
