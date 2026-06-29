import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  getCurrentUser,
  getUserById,
  updateCurrentUserName,
} from "./user.controller.js";
import { updateNameSchema } from "./user.schema.js";

const router = Router();

router.get("/me", authenticate, getCurrentUser);
router.patch(
  "/me/name",
  authenticate,
  validate(updateNameSchema),
  updateCurrentUserName,
);
router.get("/:id", authenticate, getUserById);

export default router;
