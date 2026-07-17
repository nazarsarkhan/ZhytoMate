import Notification from "./notification.model.js";

export function findNotificationsByUserId({ userId, limit = 50 }) {
  return Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export function countUnreadNotifications(userId) {
  return Notification.countDocuments({ user: userId, readAt: null });
}

export function markNotificationRead({ notificationId, userId }) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();
}

export function markAllNotificationsRead(userId) {
  return Notification.updateMany(
    { user: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
}

export function createNotificationForUser({ userId, notification }) {
  return Notification.findOneAndUpdate(
    { user: userId, dedupeKey: notification.dedupeKey },
    { $setOnInsert: { user: userId, ...notification } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function createNotificationsForUsers({ userIds, notification }) {
  if (!userIds.length) return;

  await Notification.bulkWrite(
    userIds.map((userId) => ({
      updateOne: {
        filter: { user: userId, dedupeKey: notification.dedupeKey },
        update: { $setOnInsert: { user: userId, ...notification } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

export default {
  findNotificationsByUserId,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotificationForUser,
  createNotificationsForUsers,
};
