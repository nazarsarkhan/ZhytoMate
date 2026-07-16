import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { getStatus } from "./alert.controller.js";

const router = Router();

router.get("/status", authenticate, getStatus);

export default router;
