import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { chats } from "../../consts/homeData.js";

export default function ChatHistoryPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filteredChats = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return chats.filter((chat) => {
      const searchable = `${chat.title} ${chat.preview} ${chat.date}`.toLowerCase();
      return !normalizedQuery || searchable.includes(normalizedQuery);
    });
  }, [query]);

  return (
    <Shell className="bg-surface-container-low pb-28">
      <AppHeader title={t("chat.history")} backTo="/assistant" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-3 overflow-y-auto px-container-padding py-3 sm:px-6 md:px-8 md:py-8">
        <SearchInput placeholder={t("chat.searchPlaceholder")} value={query} onChange={setQuery} />
        {filteredChats.map((chat) => (
          <Link key={chat.id} className="motion-card interactive-card flex w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm transition active:scale-[0.98] md:p-5" to={`/chat-history/${chat.id}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chat.active ? "bg-primary-container text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
              <Icon name="smart_toy" className="text-xl" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${chat.active ? "text-on-surface" : "text-on-surface/70"}`}>{chat.title}</span>
              <span className="mt-1 block text-xs text-on-surface-variant">{chat.preview}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{chat.date}</span>
            </span>
            <Icon name="chevron_right" className="mt-2 text-outline" />
          </Link>
        ))}
        {!filteredChats.length ? <p className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">{t("chat.empty")}</p> : null}
      </main>
      <BottomNav active="assistant" />
    </Shell>
  );
}
