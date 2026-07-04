import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import NotificationCard from "../../components/notifications/NotificationCard.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { notifications } from "../../consts/homeData.js";

export default function NotificationsPage() {
  return (
    <Shell className="bg-background pb-28">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center gap-4 px-container-padding sm:px-6 md:h-24 md:gap-5 md:px-8">
        <Link to="/assistant" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-surface-container active:scale-95">
          <Icon name="arrow_back" className="text-4xl text-primary" />
        </Link>
        <h1 className="min-w-0 text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl">Повідомлення</h1>
      </header>
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
      <BottomNav active="notifications" />
    </Shell>
  );
}
