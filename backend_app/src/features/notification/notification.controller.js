import {
  getUserNotifications,
  getUserUnreadCount,
  readAllNotifications,
  readNotification,
  notifyAnnouncementPublished,
} from "./notification.service.js";

export async function listNotifications(req, res, next) {
  try {
    const notifications = await getUserNotifications({
      userId: req.user.id,
      limit: req.validatedQuery.limit,
    });
    return res.json({ notifications });
  } catch (err) {
    return next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    return res.json({ count: await getUserUnreadCount(req.user.id) });
  } catch (err) {
    return next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const notification = await readNotification({
      notificationId: req.params.id,
      userId: req.user.id,
    });
    return res.json({ notification });
  } catch (err) {
    return next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await readAllNotifications(req.user.id);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

export async function publishAnnouncement(req, res, next) {
  try {
    await notifyAnnouncementPublished(req.body);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

export default { listNotifications, unreadCount, markRead, markAllRead, publishAnnouncement };
