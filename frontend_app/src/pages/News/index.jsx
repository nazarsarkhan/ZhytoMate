import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import PageHero from "../../components/layout/PageHero.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Icon from "../../components/ui/Icon.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import { newsCategory } from "../../consts/newsCategories.js";
import { useNews } from "../../hooks/useNews.js";
import { formatDate } from "../../lib/formatDate.js";

const SUMMARY_MAX_LENGTH = 100;

function getSummaryPreview(summary) {
  const text = String(summary || "").trim();
  if (text.length <= SUMMARY_MAX_LENGTH) return { text, truncated: false };

  const shortened = text.slice(0, SUMMARY_MAX_LENGTH).trimEnd();
  const lastWordBoundary = shortened.lastIndexOf(" ");
  return {
    text: `${(lastWordBoundary > 120 ? shortened.slice(0, lastWordBoundary) : shortened).trim()}...`,
    truncated: true,
  };
}

export default function NewsPage() {
  const newsQuery = useNews();
  const news = newsQuery.data || [];

  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(() => {
    const present = Array.from(new Set(news.map((item) => item.category).filter(Boolean)));
    return [
      { value: "all", label: "Усі" },
      ...present.map((value) => ({ value, label: newsCategory(value).label })),
    ];
  }, [news]);

  const filteredNews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return news.filter((item) => {
      const matchesCategory = !selectedCategories.length || selectedCategories.includes(item.category);
      const searchable = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [news, query, selectedCategories]);

  return (
    <Shell className="bg-background pb-28">
      <PageHero title="Новини та події Житомира">
        <div className="mx-auto max-w-3xl">
          <SearchInput dark placeholder="Пошук новин..." value={query} onChange={setQuery} />
          <div className="mt-4 flex gap-3">
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 transition active:scale-95" type="button" onClick={() => setFiltersOpen(true)}>
              <Icon name="tune" />
            </button>
            <FilterChips dark items={categories} selectedValues={selectedCategories} onChange={setSelectedCategories} />
          </div>
        </div>
      </PageHero>
      <main className="mx-auto grid w-full max-w-6xl gap-3 px-container-padding py-section-margin sm:px-6 md:grid-cols-2 md:px-8 lg:grid-cols-3">
        {filteredNews.map((item) => {
          const meta = newsCategory(item.category);
          const summary = getSummaryPreview(item.summary);
          return (
            <Link key={item.id} to={`/news/${item.id}`} className="motion-card interactive-card flex h-full gap-4 rounded-xl border border-surface-variant bg-surface p-4 text-left shadow-soft transition active:scale-[0.98]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
                <Icon name={meta.icon} filled />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-2 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                  <span className="truncate">{item.source}</span>
                  <span className="shrink-0">{formatDate(item.publishedAt)}</span>
                </span>
                <span className="block text-base font-bold leading-tight text-on-surface">{item.title}</span>
                <span className="relative mt-2 block max-h-[88px] overflow-hidden text-sm leading-5 text-on-surface-variant">
                  {summary.text}
                  {summary.truncated ? (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-surface via-surface/90 to-transparent" />
                  ) : null}
                </span>
              </span>
            </Link>
          );
        })}
        {newsQuery.isLoading ? (
          <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">Завантаження...</p>
        ) : null}
        {!newsQuery.isLoading && !filteredNews.length ? (
          <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">Новини не знайдено</p>
        ) : null}
        {newsQuery.hasNextPage ? (
          <button
            className="col-span-full mx-auto flex h-12 items-center justify-center gap-2 rounded-full bg-secondary-container px-6 text-sm font-bold text-on-secondary-container shadow-sm transition hover:bg-secondary-fixed active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            type="button"
            disabled={newsQuery.isFetchingNextPage}
            onClick={() => newsQuery.fetchNextPage()}
          >
            {newsQuery.isFetchingNextPage ? "Завантаження..." : "Показати ще новини"}
            {!newsQuery.isFetchingNextPage ? <Icon name="expand_more" className="text-xl" /> : null}
          </button>
        ) : null}
      </main>
      <BottomNav active="news" />
      <Modal open={filtersOpen} title="Фільтри новин" sheet onClose={() => setFiltersOpen(false)}>
        <FilterChips items={categories} selectedValues={selectedCategories} onChange={setSelectedCategories} />
      </Modal>
    </Shell>
  );
}
