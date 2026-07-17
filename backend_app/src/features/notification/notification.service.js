import { ApiError } from "../../shared/ApiError.js";
import { findAllUserIds } from "../user/user.repository.js";
import {
  countUnreadNotifications,
  createNotificationForUser,
  createNotificationsForUsers,
  findNotificationsByUserId,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.repository.js";
import { toPublicNotification } from "./notification.model.js";

function baseNotification({ type, category, title, body, entityType, entityId, route, dedupeKey }) {
  return {
    type,
    category,
    title,
    body,
    entityType: entityType || "",
    entityId: entityId || "",
    route: route || "",
    dedupeKey,
  };
}

export async function getUserNotifications({ userId, limit }) {
  const notifications = await findNotificationsByUserId({ userId, limit });
  return notifications.map(toPublicNotification);
}

export function getUserUnreadCount(userId) {
  return countUnreadNotifications(userId);
}

export async function readNotification({ notificationId, userId }) {
  const notification = await markNotificationRead({ notificationId, userId });
  if (!notification) throw ApiError.notFound("Notification not found");
  return toPublicNotification(notification);
}

export function readAllNotifications(userId) {
  return markAllNotificationsRead(userId);
}

export function notifyAppealStatusChanged({ appeal, previousStatus }) {
  if (!previousStatus || previousStatus === appeal.status) return Promise.resolve();

  return createNotificationForUser({
    userId: appeal.user,
    notification: baseNotification({
      type: "appeal_status_changed",
      category: "Звернення",
      title: "Статус звернення змінено",
      body: `Ваше звернення отримало новий статус: ${appeal.status}.`,
      entityType: "appeal",
      entityId: appeal._id.toString(),
      route: `/services/appeals/${appeal._id}`,
      dedupeKey: `appeal:${appeal._id}:status:${appeal.status}`,
    }),
  });
}

export async function notifySurveyPublished(survey) {
  const userIds = await findAllUserIds();
  return createNotificationsForUsers({
    userIds,
    notification: baseNotification({
      type: "survey_published",
      category: "Опитування",
      title: "Нове опитування",
      body: survey.title,
      entityType: "survey",
      entityId: survey._id.toString(),
      route: `/services/polls/${survey._id}`,
      dedupeKey: `survey:${survey._id}:published`,
    }),
  });
}

export async function notifyAnnouncementPublished({ title, body, id }) {
  const userIds = await findAllUserIds();
  return createNotificationsForUsers({
    userIds,
    notification: baseNotification({
      type: "announcement",
      category: "Анонси",
      title,
      body,
      entityType: "announcement",
      entityId: id,
      route: "/notifications",
      dedupeKey: `announcement:${id}`,
    }),
  });
}

export default {
  getUserNotifications,
  getUserUnreadCount,
  readNotification,
  readAllNotifications,
  notifyAppealStatusChanged,
  notifySurveyPublished,
  notifyAnnouncementPublished,
};
