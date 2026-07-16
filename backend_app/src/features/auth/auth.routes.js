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
import { authRateLimit } from "./auth.rateLimit.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "./auth.schema.js";

const router = Router();

router.post("/register", authRateLimit({ windowMs: 15 * 60_000, max: 10 }), validate(registerSchema), registerUser);
router.post("/login", authRateLimit({ windowMs: 5 * 60_000, max: 20 }), validate(loginSchema), loginUser);
router.post("/refresh", authRateLimit({ windowMs: 5 * 60_000, max: 30 }), validate(refreshSchema), refreshToken);
router.get("/me", authenticate, me);
router.patch(
  "/password",
  authenticate,
  validate(changePasswordSchema),
  changePasswordHandler,
);

export default router;
