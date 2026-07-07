import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  createUserProfile,
  getUserById,
  getUserByEmailOrUsername,
  updateUserPassword,
} from "../user/user.service.js";
import { toPublicUser } from "../user/user.model.js";

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type: "access",
    },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiresIn },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      tokenVersion: user.refreshTokenVersion ?? 0,
      type: "refresh",
    },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn },
  );
}

function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

export async function register({
  username,
  firstName,
  lastName,
  email,
  password: plainPassword,
}) {
  const password = await bcrypt.hash(plainPassword, 12);
  // Public registration always creates a plain "user" - role is never taken from the request
  // (registerSchema drops it, and we hardcode it here as defense-in-depth).
  const user = await createUserProfile({
    username,
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    role: "user",
  });

  return {
    user: toPublicUser(user),
    ...issueTokens(user),
  };
}

export async function login({ emailOrUsername, password }) {
  const user = await getUserByEmailOrUsername(emailOrUsername);
  if (!user) {
    throw ApiError.unauthorized("Invalid login or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized("Invalid login or password");
  }

  return {
    user: toPublicUser(user),
    ...issueTokens(user),
  };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized("Refresh token is required");
  }

  let decodedRefreshToken;
  try {
    decodedRefreshToken = jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  if (decodedRefreshToken.type !== "refresh" || !decodedRefreshToken.sub) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  const user = await getUserById(decodedRefreshToken.sub);
  if (
    !user ||
    (user.refreshTokenVersion ?? 0) !== decodedRefreshToken.tokenVersion
  ) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  return {
    accessToken: signAccessToken(user),
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw ApiError.unauthorized("User not found");
  }

  return toPublicUser(user);
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await getUserById(userId);
  if (!user) {
    throw ApiError.unauthorized("User not found");
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  const password = await bcrypt.hash(newPassword, 12);
  const updatedUser = await updateUserPassword({ id: userId, password });

  // The refreshTokenVersion bump inside updateUserPassword already invalidated every existing
  // refresh token (including this session's) - re-issue a fresh pair so the caller stays logged in.
  return {
    user: toPublicUser(updatedUser),
    ...issueTokens(updatedUser),
  };
}

export default {
  register,
  login,
  refreshAccessToken,
  getCurrentUser,
  changePassword,
};
