import { ApiError } from "../../shared/ApiError.js";
import {
  countSurveys,
  countVotesByOption,
  countVotesByUserId,
  createSurvey,
  findSurveyById,
  findSurveys,
  findVoteBySurveyAndUser,
  findVotesByUserId,
  upsertSurveyVote,
} from "./survey.repository.js";
import {
  isSurveyOpen,
  toPublicSurvey,
  toPublicSurveyVote,
} from "./survey.model.js";

function assertAdmin(role) {
  if (role !== "admin") {
    throw ApiError.forbidden("Admin access is required");
  }
}

function mapVotesBySurveyId(votes) {
  return new Map(votes.map((vote) => [vote.survey.toString(), vote]));
}

export async function createSurveyForUsers({
  role,
  title,
  description,
  category,
  options,
  startsAt,
  endsAt,
  isActive,
}) {
  assertAdmin(role);

  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    throw ApiError.badRequest("startsAt must be before endsAt");
  }

  const survey = await createSurvey({
    title,
    description,
    category,
    options: options.map((label) => ({ label })),
    startsAt,
    endsAt,
    isActive,
  });

  return toPublicSurvey(survey);
}

export async function getSurveyHistory(userId) {
  const [surveys, votes] = await Promise.all([
    findSurveys(),
    findVotesByUserId(userId),
  ]);
  const votesBySurveyId = mapVotesBySurveyId(votes);
  const tallies = await Promise.all(
    surveys.map((survey) => countVotesByOption(survey._id.toString())),
  );

  return surveys.map((survey, index) =>
    toPublicSurvey(survey, votesBySurveyId.get(survey._id.toString()), tallies[index]),
  );
}

export async function getSurveyProgress(userId) {
  const [total, answered] = await Promise.all([
    countSurveys(),
    countVotesByUserId(userId),
  ]);
  const pending = Math.max(total - answered, 0);
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

  return {
    total,
    answered,
    pending,
    percent,
  };
}

export async function getSurveyForUser({ surveyId, userId }) {
  const [survey, vote, tallies] = await Promise.all([
    findSurveyById(surveyId),
    findVoteBySurveyAndUser({ surveyId, userId }),
    countVotesByOption(surveyId),
  ]);

  if (!survey) {
    throw ApiError.notFound("Survey not found");
  }

  return toPublicSurvey(survey, vote, tallies);
}

export async function voteInSurvey({ surveyId, userId, optionId }) {
  const survey = await findSurveyById(surveyId);
  if (!survey) {
    throw ApiError.notFound("Survey not found");
  }

  if (!isSurveyOpen(survey)) {
    throw ApiError.badRequest("Survey is not open");
  }

  const optionExists = survey.options.some(
    (option) => option._id.toString() === optionId,
  );

  if (!optionExists) {
    throw ApiError.badRequest("Survey option not found");
  }

  const vote = await upsertSurveyVote({ surveyId, userId, optionId });
  return toPublicSurveyVote(vote);
}

export default {
  createSurveyForUsers,
  getSurveyHistory,
  getSurveyProgress,
  getSurveyForUser,
  voteInSurvey,
};
