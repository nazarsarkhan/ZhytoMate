import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Toast from "../../components/ui/Toast.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { newsCategory } from "../../consts/newsCategories.js";
import { useNewsItem } from "../../hooks/useNews.js";
import { formatDate } from "../../lib/formatDate.js";

export default function NewsDetailPage() {
  const { newsId } = useParams();
  const newsQuery = useNewsItem(newsId);
  const item = newsQuery.data;
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item?.title, url: window.location.href });
      } else {
        await navigator.clipboard?.writeText(window.location.href);
      }
      showToast("Посилання скопійовано");
    } catch {
      showToast("Посилання скопійовано");
    }
  };

  if (newsQuery.isError) return <Navigate to="/news" replace />;
  if (!item) return null;

  const meta = newsCategory(item.category);

  return (
    <Shell className="bg-surface-bright pb-28">
      <AppHeader title="Новини" backTo="/news" rightIcon="share" rightLabel="Поділитися" onRightClick={handleShare} />
      <main className="mx-auto w-full max-w-5xl px-container-padding pb-section-margin sm:px-6 md:px-8">
        {item.coverImageUrl ? (
          <div className="motion-card relative mt-4 overflow-hidden rounded-2xl bg-surface-container-low shadow-soft md:mt-8 md:rounded-3xl">
            <img className="h-56 w-full object-cover md:h-[380px]" alt="" src={item.coverImageUrl} />
            <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/90 px-3 py-1 shadow-sm backdrop-blur-sm">
              <Icon name={meta.icon} filled className="text-base text-tertiary-container" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary-container">{meta.label}</span>
            </div>
          </div>
        ) : null}
        <article className={`motion-card relative z-10 rounded-2xl border border-outline-variant/20 bg-white p-5 shadow-soft md:mx-auto md:max-w-3xl md:p-8 ${item.coverImageUrl ? "-mt-10" : "mt-4 md:mt-8"}`}>
          {!item.coverImageUrl ? (
            <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary">
              <Icon name={meta.icon} filled className="text-base" /> {meta.label}
            </span>
          ) : null}
          <h2 className="mb-3 text-2xl font-bold leading-tight md:text-4xl">{item.title}</h2>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1"><Icon name="calendar_today" className="text-base" />{formatDate(item.publishedAt)}</span>
            {item.source ? (
              <>
                <span className="h-1 w-1 rounded-full bg-outline-variant" />
                <span className="flex items-center gap-1 text-on-tertiary-fixed-variant"><Icon name="account_balance" filled className="text-base" />{item.source}</span>
              </>
            ) : null}
          </div>
          {item.summary ? (
            <p className="mb-4 border-t border-outline-variant/30 pt-5 text-base font-semibold leading-7 text-on-surface md:text-lg">{item.summary}</p>
          ) : null}
          <div className={`space-y-4 text-base leading-7 text-on-background md:text-lg md:leading-8 ${item.summary ? "" : "border-t border-outline-variant/30 pt-5"}`}>
            <p className="whitespace-pre-line">{item.body}</p>
          </div>
          {item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
              Читати в джерелі <Icon name="open_in_new" className="text-base" />
            </a>
          ) : null}
          {Array.isArray(item.tags) && item.tags.length ? (
            <div className="mt-8 flex flex-wrap gap-2 border-t border-outline-variant/30 pt-4">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1 text-xs text-on-surface-variant">#{tag}</span>
              ))}
            </div>
          ) : null}
        </article>
      </main>
      <BottomNav active="news" />
      <Toast message={toast} />
    </Shell>
  );
}
