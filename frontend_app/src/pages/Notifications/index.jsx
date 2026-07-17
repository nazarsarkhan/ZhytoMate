import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import NotificationCard from "../../components/notifications/NotificationCard.jsx";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../../hooks/useNotifications.js";

const ICON_BY_TYPE = {
  appeal_status_changed: "assignment_turned_in",
  survey_published: "poll",
  announcement: "campaign",
};

function formatTime(value) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mapNotification(notification, onRead) {
  return {
    ...notification,
    icon: ICON_BY_TYPE[notification.type] || "notifications",
    text: notification.body,
    time: formatTime(notification.createdAt),
    active: notification.unread,
    onClick: () => {
      if (notification.unread) onRead(notification.id);
    },
  };
}

export default function NotificationsPage() {
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const notifications = (notificationsQuery.data || []).map((item) =>
    mapNotification(item, (id) => markRead.mutate(id)),
  );

  return (
    <Shell className="bg-background pb-28">
      <AppHeader title="Повідомлення" backTo="/assistant" rightIcon="" />
      <main className="mx-auto w-full max-w-6xl space-y-section-margin px-container-padding pt-6 sm:px-6 md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold md:text-3xl">Повідомлення</h2>
          {notifications.some((item) => item.unread) ? (
            <button
              className="text-sm font-semibold text-primary-container hover:underline"
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Позначити все прочитаним
            </button>
          ) : null}
        </div>

        {notificationsQuery.isLoading ? <p className="text-on-surface-variant">Завантаження...</p> : null}
        {notificationsQuery.isError ? <p className="text-on-surface-variant">Не вдалося завантажити повідомлення.</p> : null}
        {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-on-surface-variant shadow-sm ring-1 ring-outline-variant/30">
            Нових повідомлень поки немає.
          </div>
        ) : null}
        {notifications.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {notifications.map((item) => <NotificationCard key={item.id} item={item} />)}
          </div>
        ) : null}
      </main>
      <BottomNav active="assistant" />
    </Shell>
  );
}
