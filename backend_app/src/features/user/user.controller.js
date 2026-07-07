import { ApiError } from "../../shared/ApiError.js";
import {
  getPublicUserById,
  previewUserAddress,
  updateUserAddress,
  updateUserAvatarFromUpload,
  updateUserName,
} from "./user.service.js";

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
    const { firstName, lastName, phone } = req.body;
    const user = await updateUserName({
      id: req.user.id,
      firstName,
      lastName,
      phone,
    });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

export async function updateCurrentUserAddress(req, res, next) {
  try {
    const user = await updateUserAddress({
      id: req.user.id,
      address: req.body,
    });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

// Verify/normalize an address without saving it (for the profile's "check address" UX).
export async function previewCurrentUserAddress(req, res, next) {
  try {
    const address = await previewUserAddress(req.body);
    return res.json({ address });
  } catch (err) {
    return next(err);
  }
}

export async function uploadCurrentUserAvatar(req, res, next) {
  try {
    if (!req.file) {
      throw ApiError.badRequest("A photo file is required");
    }

    const user = await updateUserAvatarFromUpload({
      userId: req.user.id,
      filename: req.file.filename,
      hostUrl: `${req.protocol}://${req.get("host")}`,
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
  updateCurrentUserAddress,
  previewCurrentUserAddress,
  uploadCurrentUserAvatar,
};
