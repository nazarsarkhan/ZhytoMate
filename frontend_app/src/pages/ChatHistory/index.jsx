import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useConversations } from "../../hooks/useConversations.js";
import { formatDate } from "../../lib/formatDate.js";

export default function ChatHistoryPage() {
  const conversations = useConversations();
  const [query, setQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const list = conversations.data || [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return list;
    return list.filter((conversation) => {
      const searchable = `${conversation.title} ${conversation.lastMessage}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [conversations.data, query]);

  return (
    <Shell className="bg-surface-container-low pb-28">
      <AppHeader title="Історія чатів" backTo="/assistant" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-3 overflow-y-auto px-container-padding py-3 sm:px-6 md:px-8 md:py-8">
        <SearchInput placeholder="Пошук повідомлень..." value={query} onChange={setQuery} />
        {filteredConversations.map((conversation) => (
          <Link key={conversation.id} className="motion-card interactive-card flex w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm transition active:scale-[0.98] md:p-5" to={`/chat-history/${conversation.id}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary">
              <Icon name="smart_toy" className="text-xl" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-on-surface">{conversation.title}</span>
              <span className="mt-1 block truncate text-xs text-on-surface-variant">{conversation.lastMessage}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{formatDate(conversation.lastMessageAt)}</span>
            </span>
            <Icon name="chevron_right" className="mt-2 text-outline" />
          </Link>
        ))}
        {!conversations.isLoading && !filteredConversations.length ? <p className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">Чати не знайдено</p> : null}
      </main>
      <BottomNav active="assistant" />
    </Shell>
  );
}
