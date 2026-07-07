import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  getCurrentUser,
  getUserById,
  previewCurrentUserAddress,
  updateCurrentUserAddress,
  updateCurrentUserName,
  uploadCurrentUserAvatar,
} from "./user.controller.js";
import { updateAddressSchema, updateNameSchema } from "./user.schema.js";
import { uploadAvatarPhoto } from "./user.upload.js";

const router = Router();

router.get("/me", authenticate, getCurrentUser);
router.patch(
  "/me/name",
  authenticate,
  validate(updateNameSchema),
  updateCurrentUserName,
);
router.patch(
  "/me/address",
  authenticate,
  validate(updateAddressSchema),
  updateCurrentUserAddress,
);
router.post(
  "/me/address/preview",
  authenticate,
  validate(updateAddressSchema),
  previewCurrentUserAddress,
);
router.post(
  "/me/avatar",
  authenticate,
  uploadAvatarPhoto.single("avatar"),
  uploadCurrentUserAvatar,
);
router.get("/:id", authenticate, getUserById);

export default router;
