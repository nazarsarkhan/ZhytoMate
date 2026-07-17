import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import {
  acquireAdminUserUpdateLock,
  countActiveAdmins,
  createUser,
  findAdminUsers,
  findUserByEmailOrUsername,
  findUserByIdAndUpdateAddress,
  findUserByIdAndUpdateAvatar,
  findUserByIdAndUpdateName,
  findUserByIdAndUpdatePassword,
  findUserByIdAndUpdatePreferences,
  findUserById,
  releaseAdminUserUpdateLock,
  updateAdminUserById,
} from "./user.repository.js";
import { ApiError } from "../../shared/ApiError.js";
import { resolveAddressSelection, reverseAddress, searchAddresses } from "../../shared/geocodeClient.js";
import { toPublicUser } from "./user.model.js";
import { UPLOAD_DIR } from "./user.upload.js";

const ADMIN_USER_UPDATE_FIELDS = [
  "username",
  "firstName",
  "lastName",
  "email",
  "phone",
  "role",
  "isActive",
];
const ADMIN_USER_UPDATE_LOCK_RETRY_MS = 25;
const ADMIN_USER_UPDATE_LOCK_TIMEOUT_MS = 5_000;
const ADMIN_USER_UPDATE_LOCK_TTL_MS = 10_000;

function pickAdminUserUpdates(updates) {
  return ADMIN_USER_UPDATE_FIELDS.reduce((result, field) => {
    if (updates[field] === undefined) {
      return result;
    }

    result[field] =
      field === "email" ? updates[field].toLowerCase() : updates[field];
    return result;
  }, {});
}

async function withAdminUserUpdateLock(run) {
  const token = crypto.randomUUID();
  const deadline = Date.now() + ADMIN_USER_UPDATE_LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const lockUntil = new Date(Date.now() + ADMIN_USER_UPDATE_LOCK_TTL_MS);
    const acquiredToken = await acquireAdminUserUpdateLock(token, lockUntil);

    if (acquiredToken) {
      try {
        return await run();
      } finally {
        await releaseAdminUserUpdateLock(token);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, ADMIN_USER_UPDATE_LOCK_RETRY_MS));
  }

  throw ApiError.conflict("Another admin user update is already in progress");
}

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

export async function listAdminUsers(filters = {}) {
  const users = await findAdminUsers(filters);
  return users.map(toPublicUser);
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

export async function updateAdminUser({ id, updates }) {
  return withAdminUserUpdateLock(async () => {
    const existingUser = await findUserById(id);
    if (!existingUser) {
      throw ApiError.notFound("User not found");
    }

    const existingIsActive = existingUser.isActive !== false;
    const nextRole = updates.role ?? existingUser.role;
    const nextIsActive = updates.isActive ?? existingIsActive;
    const revokeRefreshSessions =
      (updates.role !== undefined && nextRole !== existingUser.role)
      || (updates.isActive !== undefined && nextIsActive !== existingIsActive);

    if (
      existingUser.role === "admin"
      && existingIsActive
      && (nextRole !== "admin" || nextIsActive !== true)
    ) {
      const remainingActiveAdmins = await countActiveAdmins({
        excludingUserId: id,
      });

      if (remainingActiveAdmins === 0) {
        throw ApiError.conflict("Cannot remove the last active admin");
      }
    }

    const user = await updateAdminUserById(
      id,
      pickAdminUserUpdates(updates),
      { revokeRefreshSessions },
    );

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    return toPublicUser(user);
  });
}

export default {
  getUserById,
  getPublicUserById,
  getUserByEmailOrUsername,
  listAdminUsers,
  createUserProfile,
  updateUserName,
  updateUserAddress,
  searchUserAddresses,
  updateUserPreferences,
  previewUserAddress,
  updateUserAvatarFromUpload,
  updateUserPassword,
  updateAdminUser,
};
