import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import TopBar from "../../components/topbar/TopBar.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { polls } from "../../consts/serviceData.js";

function PollCard({ poll }) {
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
      <div className="mt-4 border-t border-surface-variant pt-3">
        <Link to={poll.active ? `/services/polls/${poll.id}` : "/services/polls"} className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold ${poll.active ? "bg-secondary-container text-on-secondary-container" : "border border-primary text-primary"}`}>
          {poll.active ? "Проголосувати" : "Переглянути результати"} <Icon name={poll.active ? "how_to_vote" : "bar_chart"} className="text-lg" />
        </Link>
      </div>
    </article>
  );
}

export default function PollsPage() {
  return (
    <Shell className="bg-background pb-28">
      <TopBar title="Опитування" backTo="/services" rightIcon="notifications" />
      <main className="mx-auto w-full max-w-4xl px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="no-scrollbar mb-section-margin flex gap-2 overflow-x-auto pb-2">
          {["Активні", "Завершені", "Мої голоси"].map((tab, index) => (
            <button key={tab} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${index === 0 ? "border-secondary-container bg-secondary-container text-on-secondary-container" : "border-outline-variant bg-surface-container-high text-on-surface-variant"}`}>{tab}</button>
          ))}
        </div>
        <div className="grid gap-stack-gap md:grid-cols-2">
          {polls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
        </div>
      </main>
      <BottomNav active="services" />
    </Shell>
  );
}
