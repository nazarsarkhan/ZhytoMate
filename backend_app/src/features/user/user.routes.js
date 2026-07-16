import { Router } from "express";
import { validate, validateQuery } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  getCurrentUser,
  getUserById,
  previewCurrentUserAddress,
  reverseCurrentUserAddress,
  searchCurrentUserAddresses,
  updateCurrentUserAddress,
  updateCurrentUserName,
  updateCurrentUserPreferences,
  uploadCurrentUserAvatar,
} from "./user.controller.js";
import {
  addressSuggestionsQuerySchema,
  addressReverseQuerySchema,
  updateAddressSchema,
  updateNameSchema,
  updatePreferencesSchema,
} from "./user.schema.js";
import { uploadAvatarPhoto } from "./user.upload.js";

const router = Router();

router.get(
  "/me/address/suggestions",
  authenticate,
  validateQuery(addressSuggestionsQuerySchema),
  searchCurrentUserAddresses,
);

router.get(
  "/me/address/reverse",
  authenticate,
  validateQuery(addressReverseQuerySchema),
  reverseCurrentUserAddress,
);

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
router.patch(
  "/me/preferences",
  authenticate,
  validate(updatePreferencesSchema),
  updateCurrentUserPreferences,
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
