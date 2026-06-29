import User from "./user.model.js";

export function findUserById(id) {
  return User.findById(id);
}

export function findUserByIdAndUpdateName({ id, firstName, lastName }) {
  return User.findByIdAndUpdate(
    id,
    { firstName, lastName },
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
  findUserByEmailOrUsername,
  createUser,
};
