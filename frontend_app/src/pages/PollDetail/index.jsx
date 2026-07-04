import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Toast from "../../components/ui/Toast.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { polls } from "../../consts/serviceData.js";

function ResultsPanel({ poll, selectedOptionId, voted }) {
  const { t } = useTranslation();
  const leader = useMemo(() => [...poll.options].sort((a, b) => b.percent - a.percent)[0], [poll.options]);

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">{t("polls.anonymousStats")}</h2>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">{t("polls.privacy")}</p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">{t("polls.totalVotes", { count: poll.totalVotes })}</span>
      </div>
      <div className="mb-4 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-3">
        <span className="rounded-lg bg-surface-container-low px-3 py-2"><b>{t("polls.scope")}:</b> {poll.eligibleScopeLabel}</span>
        <span className="rounded-lg bg-surface-container-low px-3 py-2"><b>{t("polls.updated")}:</b> {poll.lastUpdated}</span>
        <span className="rounded-lg bg-surface-container-low px-3 py-2"><b>{t("polls.leader")}:</b> {leader.title}</span>
      </div>
      <div className="space-y-3">
        {poll.options.map((option) => {
          const isMine = selectedOptionId === option.id;
          return (
            <div key={option.id} className={`rounded-xl border p-3 ${isMine ? "border-secondary-container bg-secondary-container/10" : "border-outline-variant/30 bg-surface"}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-bold text-on-surface">{option.title}</span>
                <span className="text-sm font-bold text-primary-container">{option.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-secondary-container" style={{ width: `${option.percent}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                <span>{option.votes} голосів</span>
                {isMine && voted ? <span className="font-bold text-on-secondary-container">{t("polls.voteRecorded")}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PollDetailPage() {
  const { t } = useTranslation();
  const { pollId } = useParams();
  const poll = polls.find((item) => item.id === pollId);
  const [selectedOptionId, setSelectedOptionId] = useState(poll?.options?.[0]?.id || "");
  const [voted, setVoted] = useState(!poll?.active || Boolean(poll?.voted));
  const [toast, setToast] = useState("");

  if (!poll) return <Navigate to="/services/polls" replace />;

  const selectedOption = poll.options.find((option) => option.id === selectedOptionId);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const handleShare = async () => {
    const shareData = {
      title: poll.title,
      text: poll.text,
      url: window.location.href,
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(window.location.href);
      showToast(t("common.shared"));
    } catch {
      showToast(t("common.shared"));
    }
  };

  const handleVote = () => {
    if (!selectedOptionId) {
      showToast(t("polls.selectOption"));
      return;
    }
    setVoted(true);
    showToast(t("polls.voteRecorded"));
  };

  return (
    <Shell className="bg-background pb-44">
      <AppHeader title={t("polls.title")} backTo="/services/polls" rightIcon="share" rightLabel={t("common.share")} onRightClick={handleShare} />
      <main className="mx-auto w-full max-w-2xl space-y-section-margin px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary">
            <Icon name={poll.icon} className="text-base" /> {poll.category}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${poll.active ? "bg-error-container text-error" : "bg-green-100 text-green-700"}`}>
            <Icon name={poll.active ? "schedule" : "check_circle"} className="text-base" /> {poll.timeLeft}
          </span>
        </div>
        <section>
          <h1 className="text-3xl font-bold leading-tight text-primary">{poll.title}</h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">{poll.description}</p>
        </section>
        {poll.image ? (
          <div className="overflow-hidden rounded-xl border border-outline-variant/30 shadow-sm">
            <img className="aspect-video w-full object-cover" alt="" src={poll.image} />
          </div>
        ) : null}
        {!voted && poll.active ? (
          <section>
            <h2 className="mb-3 text-lg font-bold text-primary">{t("polls.chooseOption")}</h2>
            <form className="space-y-stack-gap">
              {poll.options.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-start rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition has-[:checked]:border-secondary-container has-[:checked]:bg-secondary-container/10">
                  <input className="mt-1 h-5 w-5 text-secondary-container focus:ring-secondary-container" checked={selectedOptionId === option.id} name="voting_option" type="radio" onChange={() => setSelectedOptionId(option.id)} />
                  <span className="ml-3">
                    <span className="block font-bold text-on-surface">{option.title}</span>
                    <span className="mt-1 block text-sm leading-5 text-on-surface-variant">{option.text} {option.budget}</span>
                  </span>
                </label>
              ))}
            </form>
          </section>
        ) : (
          <ResultsPanel poll={poll} selectedOptionId={selectedOptionId} voted={voted} />
        )}
      </main>
      {poll.active && !voted ? (
        <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-40 mx-auto w-full max-w-[1180px] border-t border-outline-variant/20 bg-surface/90 p-container-padding backdrop-blur-md sm:px-6 md:px-8">
          <button className="mx-auto flex h-14 w-full max-w-2xl items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-sm active:scale-[0.98]" type="button" onClick={handleVote}>
            {t("polls.vote")} {selectedOption ? <span className="hidden text-sm sm:inline">- {selectedOption.title}</span> : null}
          </button>
        </div>
      ) : null}
      <BottomNav active="services" dark />
      <Toast message={toast} />
    </Shell>
  );
}
