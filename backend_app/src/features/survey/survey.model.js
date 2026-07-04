import mongoose from "mongoose";

const surveyOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
  },
  { _id: true },
);

const surveySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    options: {
      type: [surveyOptionSchema],
      validate: {
        validator: (options) => options.length >= 2,
        message: "Survey must have at least two options",
      },
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

const surveyVoteSchema = new mongoose.Schema(
  {
    survey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    optionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true },
);

surveyVoteSchema.index({ survey: 1, user: 1 }, { unique: true });

export const Survey = mongoose.model("Survey", surveySchema);
export const SurveyVote = mongoose.model("SurveyVote", surveyVoteSchema);

export function isSurveyOpen(survey, now = new Date()) {
  if (!survey.isActive) {
    return false;
  }

  if (survey.startsAt && survey.startsAt > now) {
    return false;
  }

  if (survey.endsAt && survey.endsAt < now) {
    return false;
  }

  return true;
}

export function toPublicSurvey(survey, vote = null) {
  const selectedOptionId = vote?.optionId?.toString() ?? null;

  return {
    id: survey._id.toString(),
    title: survey.title,
    description: survey.description,
    options: survey.options.map((option) => ({
      id: option._id.toString(),
      label: option.label,
    })),
    startsAt: survey.startsAt,
    endsAt: survey.endsAt,
    isActive: survey.isActive,
    isOpen: isSurveyOpen(survey),
    selectedOptionId,
    completed: Boolean(selectedOptionId),
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
  };
}

export function toPublicSurveyVote(vote) {
  return {
    id: vote._id.toString(),
    surveyId: vote.survey.toString(),
    userId: vote.user.toString(),
    optionId: vote.optionId.toString(),
    createdAt: vote.createdAt,
    updatedAt: vote.updatedAt,
  };
}

export default Survey;
