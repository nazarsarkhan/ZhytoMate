import Appeal from "./appeal.model.js";

export function createAppeal({ userId, imageUrl, category, description, address }) {
  return Appeal.create({
    user: userId,
    imageUrl,
    category,
    description,
    address,
  });
}

export function findAppealsByUserId(userId) {
  return Appeal.find({ user: userId }).sort({ createdAt: -1 });
}

export function findAppealById(id) {
  return Appeal.findById(id);
}

// Admin list: newest first, reporter populated so the admin UI can show name/email.
export function findAppeals({ filter = {}, skip = 0, limit = 20 }) {
  return Appeal.find(filter)
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

export function countAppeals(filter = {}) {
  return Appeal.countDocuments(filter);
}

export function updateAppealById(id, updates) {
  return Appeal.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true },
  );
}

export default {
  createAppeal,
  findAppealsByUserId,
  findAppealById,
  findAppeals,
  countAppeals,
  updateAppealById,
};
