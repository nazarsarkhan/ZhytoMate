import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { chats } from "../../consts/homeData.js";

export default function ChatHistoryPage() {
  return (
    <Shell className="bg-surface-container-low pb-28">
      <header className="flex h-16 items-center gap-4 bg-primary-container px-container-padding text-on-primary sm:px-6 md:h-20 md:rounded-b-3xl md:px-8">
        <Link to="/assistant" className="active:scale-95"><Icon name="arrow_back" /></Link>
        <h1 className="text-lg font-semibold md:text-2xl">Історія чатів</h1>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-3 overflow-y-auto px-container-padding py-3 sm:px-6 md:px-8 md:py-8">
        <label className="mb-4 flex h-12 items-center rounded-lg border border-outline-variant bg-surface-container px-3 transition focus-within:border-primary-container focus-within:bg-white md:h-14">
          <Icon name="search" className="text-outline" />
          <input className="ml-2 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-outline" placeholder="Пошук повідомлень..." />
        </label>
        {chats.map(([title, date, active]) => (
          <button key={title} className="motion-card interactive-card flex w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm transition active:scale-[0.98] md:p-5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary-container text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
              <Icon name="smart_toy" className="text-xl" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${active ? "text-on-surface" : "text-on-surface/70"}`}>{title}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{date}</span>
            </span>
            <Icon name="chevron_right" className="mt-2 text-outline" />
          </button>
        ))}
      </main>
      <BottomNav active="assistant" />
    </Shell>
  );
}
