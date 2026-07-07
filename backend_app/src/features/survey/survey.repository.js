import mongoose from "mongoose";
import { Survey, SurveyVote } from "./survey.model.js";

export function createSurvey({
  title,
  description,
  category,
  options,
  startsAt,
  endsAt,
  isActive,
}) {
  return Survey.create({
    title,
    description,
    category,
    options,
    startsAt,
    endsAt,
    isActive,
  });
}

export function findSurveys() {
  return Survey.find().sort({ createdAt: -1 });
}

export function updateSurveyById(id, updates) {
  return Survey.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true },
  );
}

export async function deleteSurveyById(id) {
  // Remove the votes first so no orphaned SurveyVote docs linger for a deleted survey.
  await SurveyVote.deleteMany({ survey: id });
  return Survey.findByIdAndDelete(id);
}

export function countVotesBySurvey(surveyId) {
  return SurveyVote.countDocuments({ survey: surveyId });
}

export function countSurveys() {
  return Survey.countDocuments();
}

export function findSurveyById(id) {
  return Survey.findById(id);
}

export function findVotesByUserId(userId) {
  return SurveyVote.find({ user: userId }).sort({ createdAt: -1 });
}

export function countVotesByUserId(userId) {
  return SurveyVote.countDocuments({ user: userId });
}

export function findVoteBySurveyAndUser({ surveyId, userId }) {
  return SurveyVote.findOne({ survey: surveyId, user: userId });
}

export function upsertSurveyVote({ surveyId, userId, optionId }) {
  return SurveyVote.findOneAndUpdate(
    { survey: surveyId, user: userId },
    { optionId },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

export async function countVotesByOption(surveyId) {
  const results = await SurveyVote.aggregate([
    { $match: { survey: new mongoose.Types.ObjectId(surveyId) } },
    { $group: { _id: "$optionId", count: { $sum: 1 } } },
  ]);
  return new Map(results.map((row) => [row._id.toString(), row.count]));
}

export default {
  createSurvey,
  findSurveys,
  updateSurveyById,
  deleteSurveyById,
  countVotesBySurvey,
  countSurveys,
  findSurveyById,
  findVotesByUserId,
  countVotesByUserId,
  findVoteBySurveyAndUser,
  upsertSurveyVote,
  countVotesByOption,
};
