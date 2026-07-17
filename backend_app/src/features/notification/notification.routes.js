import { Router } from "express";
import { validate, validateQuery } from "../../shared/validate.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
  publishAnnouncement,
} from "./notification.controller.js";
import {
  notificationIdParamsSchema,
  notificationsQuerySchema,
  publishAnnouncementSchema,
} from "./notification.schema.js";

const router = Router();

router.get("/", authenticate, validateQuery(notificationsQuerySchema), listNotifications);
router.post(
  "/announcements",
  authenticate,
  authorize("admin"),
  validate(publishAnnouncementSchema),
  publishAnnouncement,
);
router.get("/unread-count", authenticate, unreadCount);
router.patch("/read-all", authenticate, markAllRead);
router.patch(
  "/:id/read",
  authenticate,
  validate(notificationIdParamsSchema, "params"),
  markRead,
);

export default router;
