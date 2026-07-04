import Appeal from "./appeal.model.js";

export function createAppeal({ userId, imageUrl, description, address }) {
  return Appeal.create({
    user: userId,
    imageUrl,
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

export default {
  createAppeal,
  findAppealsByUserId,
  findAppealById,
};
