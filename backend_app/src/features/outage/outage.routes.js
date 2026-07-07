import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { getSchedule } from "./outage.controller.js";

const router = Router();

router.get("/schedule", authenticate, getSchedule);

export default router;
