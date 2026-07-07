import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useSurveys } from "../../hooks/useSurveys.js";
import { formatDate } from "../../lib/formatDate.js";
import { formatTimeLeft } from "../../lib/formatTimeLeft.js";

function PollCard({ poll }) {
  return (
    <article className={`motion-card rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-soft ${poll.isOpen ? "" : "opacity-80"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        {poll.category ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-variant px-2 py-1 text-xs text-on-surface-variant">
            <Icon name="poll" className="text-base" /> {poll.category}
          </span>
        ) : <span />}
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${poll.isOpen ? "text-error" : "bg-green-100 text-green-700"}`}>
          <Icon name={poll.isOpen ? "schedule" : "check_circle"} className="text-base" /> {formatTimeLeft(poll)}
        </span>
      </div>
      <h3 className="text-lg font-bold leading-tight text-on-surface">{poll.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">{poll.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
        <span className="rounded-lg bg-surface-container-low px-2 py-1.5">{poll.totalVotes} голосів</span>
        <span className="rounded-lg bg-surface-container-low px-2 py-1.5">{formatDate(poll.updatedAt)}</span>
      </div>
      <div className="mt-4 border-t border-surface-variant pt-3">
        <Link to={`/services/polls/${poll.id}`} className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold ${poll.isOpen ? "bg-secondary-container text-on-secondary-container" : "border border-primary text-primary"}`}>
          {poll.isOpen ? "Проголосувати" : "Переглянути результати"} <Icon name={poll.isOpen ? "how_to_vote" : "bar_chart"} className="text-lg" />
        </Link>
      </div>
    </article>
  );
}

export default function PollsPage() {
  const surveysQuery = useSurveys();
  const polls = surveysQuery.data || [];
  const [selectedTabs, setSelectedTabs] = useState([]);

  const tabs = useMemo(
    () => [
      { value: "all", label: "Усі" },
      { value: "active", label: "Активні" },
      { value: "completed", label: "Завершені" },
      { value: "myVotes", label: "Мої голоси" },
    ],
    [],
  );

  const filteredPolls = useMemo(() => {
    if (!selectedTabs.length) return polls;
    return polls.filter((poll) =>
      selectedTabs.some((tab) => {
        if (tab === "myVotes") return poll.completed;
        return tab === "active" ? poll.isOpen : !poll.isOpen;
      }),
    );
  }, [selectedTabs, polls]);

  return (
    <Shell className="bg-background pb-28">
      <AppHeader title="Опитування" backTo="/services" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto w-full max-w-4xl px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="mb-section-margin">
          <FilterChips items={tabs} selectedValues={selectedTabs} onChange={setSelectedTabs} />
        </div>
        <div className="grid gap-stack-gap md:grid-cols-2">
          {filteredPolls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
          {!filteredPolls.length ? <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">Сервіси не знайдено</p> : null}
        </div>
      </main>
      <BottomNav active="services" />
    </Shell>
  );
}
