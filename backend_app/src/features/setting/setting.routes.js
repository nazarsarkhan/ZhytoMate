import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  getAdminSettingsResource,
  getPublicSettingsResource,
  patchAdminSettingsResource,
} from "./setting.controller.js";
import { updatePublicSettingsSchema } from "./setting.schema.js";

const router = Router();

router.get("/public", getPublicSettingsResource);
router.get("/admin", authenticate, authorize("admin"), getAdminSettingsResource);
router.patch(
  "/admin",
  authenticate,
  authorize("admin"),
  validate(updatePublicSettingsSchema),
  patchAdminSettingsResource,
);

export default router;
