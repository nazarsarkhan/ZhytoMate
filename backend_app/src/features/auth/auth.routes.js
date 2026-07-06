import { Router } from "express";
import { validate } from "../../shared/validate.js";
import {
  changePasswordHandler,
  loginUser,
  me,
  refreshToken,
  registerUser,
} from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "./auth.schema.js";

const router = Router();

router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);
router.post("/refresh", validate(refreshSchema), refreshToken);
router.get("/me", authenticate, me);
router.patch(
  "/password",
  authenticate,
  validate(changePasswordSchema),
  changePasswordHandler,
);

export default router;
