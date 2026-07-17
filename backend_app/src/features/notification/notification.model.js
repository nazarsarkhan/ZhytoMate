import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "appeal_status_changed",
  "survey_published",
  "announcement",
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    entityType: { type: String, trim: true, default: "" },
    entityId: { type: String, trim: true, default: "" },
    route: { type: String, trim: true, default: "" },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });

export const Notification = mongoose.model("Notification", notificationSchema);

export function toPublicNotification(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    category: notification.category,
    title: notification.title,
    body: notification.body,
    entityType: notification.entityType,
    entityId: notification.entityId,
    route: notification.route,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    unread: !notification.readAt,
  };
}

export default Notification;
