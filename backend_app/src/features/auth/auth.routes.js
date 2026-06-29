import { Router } from "express";
import { validate } from "../../shared/validate.js";
import {
  loginUser,
  me,
  refreshToken,
  registerUser,
} from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);
router.post("/refresh", validate(refreshSchema), refreshToken);
router.get("/me", authenticate, me);

export default router;
