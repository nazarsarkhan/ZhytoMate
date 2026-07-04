import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { polls } from "../../consts/serviceData.js";

function PollCard({ poll, t }) {
  return (
    <article className={`motion-card rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-soft ${poll.active ? "" : "opacity-80"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-surface-variant px-2 py-1 text-xs text-on-surface-variant">
          <Icon name={poll.icon} className="text-base" /> {poll.category}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${poll.active ? "text-error" : "bg-green-100 text-green-700"}`}>
          <Icon name={poll.active ? "schedule" : "check_circle"} className="text-base" /> {poll.timeLeft}
        </span>
      </div>
      <h3 className="text-lg font-bold leading-tight text-on-surface">{poll.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">{poll.text}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
        <span className="rounded-lg bg-surface-container-low px-2 py-1.5">{t("polls.totalVotes", { count: poll.totalVotes })}</span>
        <span className="rounded-lg bg-surface-container-low px-2 py-1.5">{poll.lastUpdated}</span>
      </div>
      <div className="mt-4 border-t border-surface-variant pt-3">
        <Link to={`/services/polls/${poll.id}`} className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold ${poll.active ? "bg-secondary-container text-on-secondary-container" : "border border-primary text-primary"}`}>
          {poll.active ? t("polls.vote") : t("polls.results")} <Icon name={poll.active ? "how_to_vote" : "bar_chart"} className="text-lg" />
        </Link>
      </div>
    </article>
  );
}

export default function PollsPage() {
  const { t } = useTranslation();
  const [selectedTabs, setSelectedTabs] = useState([]);

  const tabs = useMemo(
    () => [
      { value: "all", label: t("common.all") },
      { value: "active", label: t("polls.active") },
      { value: "completed", label: t("polls.completed") },
      { value: "myVotes", label: t("polls.myVotes") },
    ],
    [t],
  );

  const filteredPolls = useMemo(() => {
    if (!selectedTabs.length) return polls;
    return polls.filter((poll) => selectedTabs.some((tab) => (tab === "myVotes" ? poll.voted : poll.tab === tab)));
  }, [selectedTabs]);

  return (
    <Shell className="bg-background pb-28">
      <AppHeader title={t("polls.title")} backTo="/services" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto w-full max-w-4xl px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="mb-section-margin">
          <FilterChips items={tabs} selectedValues={selectedTabs} onChange={setSelectedTabs} />
        </div>
        <div className="grid gap-stack-gap md:grid-cols-2">
          {filteredPolls.map((poll) => <PollCard key={poll.id} poll={poll} t={t} />)}
        </div>
      </main>
      <BottomNav active="services" />
    </Shell>
  );
}
