import fs from "node:fs/promises";
import path from "node:path";
import {
  createUser,
  findUserByEmailOrUsername,
  findUserByIdAndUpdateAddress,
  findUserByIdAndUpdateAvatar,
  findUserByIdAndUpdateName,
  findUserByIdAndUpdatePassword,
  findUserById,
} from "./user.repository.js";
import { ApiError } from "../../shared/ApiError.js";
import { verifyAddress } from "../../shared/geocodeClient.js";
import { toPublicUser } from "./user.model.js";
import { UPLOAD_DIR } from "./user.upload.js";

// Runs the raw address through Nominatim and returns the object to persist: the address is always
// saved (verified flag reflects whether it resolved), with normalized components preferred over the
// user's input when the geocoder supplies them, plus coordinates and a single-line label.
export async function buildVerifiedAddress(address) {
  const verification = await verifyAddress(address);
  const normalized =
    verification.verified && verification.normalized
      ? verification.normalized
      : {};

  return {
    street: normalized.street || address.street || "",
    building: normalized.building || address.building || "",
    district: normalized.district || address.district || "",
    city: normalized.city || address.city || "",
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
  const user = await findUserByIdAndUpdateAddress({
    id,
    address: verifiedAddress,
  });

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

export async function updateUserAvatarFromUpload({ userId, filename, hostUrl }) {
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
  previewUserAddress,
  updateUserAvatarFromUpload,
  updateUserPassword,
};
