import {
  createUser,
  findUserByEmailOrUsername,
  findUserByIdAndUpdateName,
  findUserById,
} from "./user.repository.js";
import { ApiError } from "../../shared/ApiError.js";
import { toPublicUser } from "./user.model.js";

export function getUserById(id) {
  return findUserById(id);
}

export async function getPublicUserById(id) {
  const user = await findUserById(id);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return toPublicUser(user);
}

export function getUserByEmailOrUsername(emailOrUsername) {
  return findUserByEmailOrUsername(emailOrUsername);
}

export function createUserProfile({
  username,
  firstName,
  lastName,
  email,
  password,
  role = "user",
}) {
  return createUser({
    username,
    firstName,
    lastName,
    email,
    password,
    role,
  });
}

export async function updateUserName({ id, firstName, lastName }) {
  const user = await findUserByIdAndUpdateName({
    id,
    firstName,
    lastName,
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return toPublicUser(user);
}

export default {
  getUserById,
  getPublicUserById,
  getUserByEmailOrUsername,
  createUserProfile,
  updateUserName,
};
