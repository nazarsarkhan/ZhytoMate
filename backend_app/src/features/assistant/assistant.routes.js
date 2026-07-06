import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import { query } from "./assistant.controller.js";
import { assistantQuerySchema } from "./assistant.schema.js";

const router = Router();

router.post("/query", authenticate, validate(assistantQuerySchema), query);

export default router;
