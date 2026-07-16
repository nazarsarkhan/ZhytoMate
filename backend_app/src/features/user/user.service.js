import fs from "node:fs/promises";
import path from "node:path";
import {
  createUser,
  findUserByEmailOrUsername,
  findUserByIdAndUpdateAddress,
  findUserByIdAndUpdateAvatar,
  findUserByIdAndUpdateName,
  findUserByIdAndUpdatePassword,
  findUserByIdAndUpdatePreferences,
  findUserById,
} from "./user.repository.js";
import { ApiError } from "../../shared/ApiError.js";
import { resolveAddressSelection, reverseAddress, searchAddresses } from "../../shared/geocodeClient.js";
import { toPublicUser } from "./user.model.js";
import { UPLOAD_DIR } from "./user.upload.js";

// Runs the selected address through Nominatim and returns the normalized object to persist. The
// caller rejects it when Nominatim cannot confirm a real location.
export async function buildVerifiedAddress(address) {
  const verification = await resolveAddressSelection(address);
  const normalized =
    verification.verified && verification.normalized
      ? verification.normalized
      : {};

  return {
    street: normalized.street || "",
    building: normalized.building || "",
    neighborhood: normalized.neighborhood || "",
    district: normalized.district || "",
    city: normalized.city || "",
    verified: verification.verified,
    lat: verification.lat ?? null,
    lon: verification.lon ?? null,
    formatted: verification.displayName || "",
  };
}

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

export async function updateUserName({ id, firstName, lastName, phone }) {
  const user = await findUserByIdAndUpdateName({
    id,
    firstName,
    lastName,
    phone,
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return toPublicUser(user);
}

export async function updateUserAddress({ id, address }) {
  const verifiedAddress = await buildVerifiedAddress(address);
  if (!verifiedAddress.verified || verifiedAddress.lat === null || verifiedAddress.lon === null) {
    throw ApiError.badRequest("Choose a valid address from the suggestions");
  }

  const user = await findUserByIdAndUpdateAddress({
    id,
    address: verifiedAddress,
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return toPublicUser(user);
}

export function searchUserAddresses(query) {
  return searchAddresses(query);
}

export function reverseUserAddress(coordinates) {
  return reverseAddress(coordinates);
}

export async function updateUserPreferences({ id, preferences }) {
  const user = await findUserByIdAndUpdatePreferences({ id, preferences });
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return toPublicUser(user);
}

// Preview verification without persisting - lets the profile show a normalized suggestion and the
// verified flag before the user commits to saving.
export async function previewUserAddress(address) {
  return buildVerifiedAddress(address);
}

export async function updateUserAvatarFromUpload({
  userId,
  filename,
  hostUrl,
}) {
  const previousUser = await findUserById(userId);
  const avatarUrl = `${hostUrl}/uploads/avatars/${filename}`;
  const user = await findUserByIdAndUpdateAvatar({ id: userId, avatarUrl });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Best-effort cleanup of the replaced avatar file - never blocks or fails the request over it.
  if (previousUser?.avatarUrl) {
    const previousFilename = path.basename(previousUser.avatarUrl);
    fs.unlink(path.join(UPLOAD_DIR, previousFilename)).catch(() => {});
  }

  return toPublicUser(user);
}

export async function updateUserPassword({ id, password }) {
  const user = await findUserByIdAndUpdatePassword({ id, password });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return user;
}

export default {
  getUserById,
  getPublicUserById,
  getUserByEmailOrUsername,
  createUserProfile,
  updateUserName,
  updateUserAddress,
  searchUserAddresses,
  updateUserPreferences,
  previewUserAddress,
  updateUserAvatarFromUpload,
  updateUserPassword,
};
