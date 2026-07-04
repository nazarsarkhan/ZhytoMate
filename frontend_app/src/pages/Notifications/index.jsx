import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import NotificationCard from "../../components/notifications/NotificationCard.jsx";
import { notifications } from "../../consts/homeData.js";

export default function NotificationsPage() {
  return (
    <Shell className="bg-background pb-28">
      <AppHeader title="Повідомлення" backTo="/assistant" rightIcon="" />
      <main className="mx-auto w-full max-w-6xl space-y-section-margin px-container-padding pt-6 sm:px-6 md:px-8 md:pt-8">
        <h2 className="text-2xl font-bold md:text-3xl">Сьогодні</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {notifications.slice(0, 2).map((item) => <NotificationCard key={item.title} item={item} />)}
        </div>
        <h2 className="pt-4 text-2xl font-bold md:text-3xl">Вчора</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {notifications.slice(2).map((item) => <NotificationCard key={item.title} item={item} />)}
        </div>
      </main>
      <BottomNav active="assistant" />
    </Shell>
  );
}
