import {
  createSurveyForUsers,
  deleteSurveyForAdmin,
  getSurveyForUser,
  getSurveyHistory,
  getSurveyProgress,
  updateSurvey as updateSurveyService,
  voteInSurvey,
} from "./survey.service.js";

export async function createSurvey(req, res, next) {
  try {
    const survey = await createSurveyForUsers({
      role: req.user.role,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      options: req.body.options,
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt,
      isActive: req.body.isActive,
    });

    return res.status(201).json({ survey });
  } catch (err) {
    return next(err);
  }
}

export async function getSurveys(req, res, next) {
  try {
    const surveys = await getSurveyHistory(req.user.id);
    return res.json({ surveys });
  } catch (err) {
    return next(err);
  }
}

export async function getProgress(req, res, next) {
  try {
    const progress = await getSurveyProgress(req.user.id);
    return res.json({ progress });
  } catch (err) {
    return next(err);
  }
}

export async function getSurveyById(req, res, next) {
  try {
    const survey = await getSurveyForUser({
      surveyId: req.params.id,
      userId: req.user.id,
    });

    return res.json({ survey });
  } catch (err) {
    return next(err);
  }
}

export async function voteSurvey(req, res, next) {
  try {
    const vote = await voteInSurvey({
      surveyId: req.params.id,
      userId: req.user.id,
      optionId: req.body.optionId,
    });

    return res.json({ vote });
  } catch (err) {
    return next(err);
  }
}

// Admin: edit meta / close / reopen a survey (and replace options while it has no votes).
export async function updateSurvey(req, res, next) {
  try {
    const survey = await updateSurveyService({
      surveyId: req.params.id,
      updates: req.body,
    });

    return res.json({ survey });
  } catch (err) {
    return next(err);
  }
}

// Admin: delete a survey and its votes.
export async function deleteSurvey(req, res, next) {
  try {
    const result = await deleteSurveyForAdmin(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  createSurvey,
  getSurveys,
  getProgress,
  getSurveyById,
  voteSurvey,
  updateSurvey,
  deleteSurvey,
};
