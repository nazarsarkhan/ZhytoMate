import User from "./user.model.js";

export function findUserById(id) {
  return User.findById(id);
}

export function findUserByIdAndUpdateName({ id, firstName, lastName, phone }) {
  return User.findByIdAndUpdate(
    id,
    { firstName, lastName, ...(phone !== undefined ? { phone } : {}) },
    { new: true, runValidators: true },
  );
}

export function findUserByIdAndUpdateAddress({ id, address }) {
  return User.findByIdAndUpdate(
    id,
    { address },
    { new: true, runValidators: true },
  );
}

export function findUserByIdAndUpdateAvatar({ id, avatarUrl }) {
  return User.findByIdAndUpdate(
    id,
    { avatarUrl },
    { new: true, runValidators: true },
  );
}

// Bumping refreshTokenVersion invalidates every previously-issued refresh token, the same
// mechanism auth.service.js's refreshAccessToken() already checks against - so a password change
// signs the user out of every other session, not just the one making the change.
export function findUserByIdAndUpdatePassword({ id, password }) {
  return User.findByIdAndUpdate(
    id,
    { password, $inc: { refreshTokenVersion: 1 } },
    { new: true, runValidators: true },
  );
}

export function findUserByEmailOrUsername(emailOrUsername) {
  return User.findOne({
    $or: [
      { email: emailOrUsername.toLowerCase() },
      { username: emailOrUsername },
    ],
  });
}

export function createUser({
  username,
  firstName,
  lastName,
  email,
  password,
  role,
}) {
  return User.create({
    username,
    firstName,
    lastName,
    email,
    password,
    role,
  });
}

export default {
  findUserById,
  findUserByIdAndUpdateName,
  findUserByIdAndUpdateAddress,
  findUserByIdAndUpdateAvatar,
  findUserByIdAndUpdatePassword,
  findUserByEmailOrUsername,
  createUser,
};
