import { getPublicUserById, updateUserName } from "./user.service.js";

export async function getCurrentUser(req, res, next) {
  try {
    const user = await getPublicUserById(req.user.id);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await getPublicUserById(id);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

export async function updateCurrentUserName(req, res, next) {
  try {
    const { firstName, lastName } = req.body;
    const user = await updateUserName({
      id: req.user.id,
      firstName,
      lastName,
    });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

export default {
  getCurrentUser,
  getUserById,
  updateCurrentUserName,
};
