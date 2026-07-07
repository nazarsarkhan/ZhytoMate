import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Toast from "../../components/ui/Toast.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useSurvey, useVoteSurvey } from "../../hooks/useSurveys.js";
import { formatDate } from "../../lib/formatDate.js";
import { formatTimeLeft } from "../../lib/formatTimeLeft.js";

function ResultsPanel({ poll }) {
  const leader = useMemo(() => [...poll.options].sort((a, b) => b.percent - a.percent)[0], [poll.options]);

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Анонімна статистика</h2>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">Показані лише агреговані результати. Дані окремих мешканців не відображаються і не передаються у відкриту статистику.</p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">{poll.totalVotes} голосів</span>
      </div>
      <div className="mb-4 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
        <span className="rounded-lg bg-surface-container-low px-3 py-2"><b>Оновлено:</b> {formatDate(poll.updatedAt)}</span>
        {leader ? <span className="rounded-lg bg-surface-container-low px-3 py-2"><b>Лідирує:</b> {leader.label}</span> : null}
      </div>
      <div className="space-y-3">
        {poll.options.map((option) => {
          const isMine = poll.selectedOptionId === option.id;
          return (
            <div key={option.id} className={`rounded-xl border p-3 ${isMine ? "border-secondary-container bg-secondary-container/10" : "border-outline-variant/30 bg-surface"}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-bold text-on-surface">{option.label}</span>
                <span className="text-sm font-bold text-primary-container">{option.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-secondary-container" style={{ width: `${option.percent}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                <span>{option.votes} голосів</span>
                {isMine ? <span className="font-bold text-on-secondary-container">Ваш голос враховано конфіденційно</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PollDetailPage() {
  const { pollId } = useParams();
  const pollQuery = useSurvey(pollId);
  const poll = pollQuery.data;
  const voteSurvey = useVoteSurvey(pollId);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (poll?.selectedOptionId) setSelectedOptionId(poll.selectedOptionId);
  }, [poll?.selectedOptionId]);

  if (pollQuery.isError) return <Navigate to="/services/polls" replace />;
  if (!poll) return null;

  const selectedOption = poll.options.find((option) => option.id === selectedOptionId);
  const voted = poll.completed;

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const handleShare = async () => {
    const shareData = { title: poll.title, text: poll.description, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(window.location.href);
      showToast("Посилання скопійовано");
    } catch {
      showToast("Посилання скопійовано");
    }
  };

  const handleVote = async () => {
    if (!selectedOptionId) {
      showToast("Оберіть варіант, щоб проголосувати");
      return;
    }
    try {
      await voteSurvey.mutateAsync(selectedOptionId);
      showToast("Ваш голос враховано конфіденційно");
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <Shell className="bg-background pb-44">
      <AppHeader title="Опитування" backTo="/services/polls" rightIcon="share" rightLabel="Поділитися" onRightClick={handleShare} />
      <main className="mx-auto w-full max-w-2xl space-y-section-margin px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-2">
          {poll.category ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary">
              <Icon name="poll" className="text-base" /> {poll.category}
            </span>
          ) : <span />}
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${poll.isOpen ? "bg-error-container text-error" : "bg-green-100 text-green-700"}`}>
            <Icon name={poll.isOpen ? "schedule" : "check_circle"} className="text-base" /> {formatTimeLeft(poll)}
          </span>
        </div>
        <section>
          <h1 className="text-3xl font-bold leading-tight text-primary">{poll.title}</h1>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">{poll.description}</p>
        </section>
        {!voted && poll.isOpen ? (
          <section>
            <h2 className="mb-3 text-lg font-bold text-primary">Оберіть варіант реалізації:</h2>
            <form className="space-y-stack-gap">
              {poll.options.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-start rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition has-[:checked]:border-secondary-container has-[:checked]:bg-secondary-container/10">
                  <input className="mt-1 h-5 w-5 text-secondary-container focus:ring-secondary-container" checked={selectedOptionId === option.id} name="voting_option" type="radio" onChange={() => setSelectedOptionId(option.id)} />
                  <span className="ml-3 block font-bold text-on-surface">{option.label}</span>
                </label>
              ))}
            </form>
          </section>
        ) : (
          <ResultsPanel poll={poll} />
        )}
      </main>
      {poll.isOpen && !voted ? (
        <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-40 mx-auto w-full max-w-[1180px] border-t border-outline-variant/20 bg-surface/90 p-container-padding backdrop-blur-md sm:px-6 md:px-8">
          <button
            className="mx-auto flex h-14 w-full max-w-2xl items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={voteSurvey.isPending}
            type="button"
            onClick={handleVote}
          >
            Проголосувати {selectedOption ? <span className="hidden text-sm sm:inline">- {selectedOption.label}</span> : null}
          </button>
        </div>
      ) : null}
      <BottomNav active="services" dark />
      <Toast message={toast} />
    </Shell>
  );
}
