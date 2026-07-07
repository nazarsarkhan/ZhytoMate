import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export default function NewsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const newsQuery = useNews();
  const news = newsQuery.data || [];

  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Only offer chips for categories actually present in the fetched news (plus "all"), so the
  // filter never lists an empty bucket. FilterChips treats the "all" chip as "clear selection".
  const categories = useMemo(() => {
    const present = Array.from(new Set(news.map((item) => item.category).filter(Boolean)));
    return [
      { value: "all", label: t("categories.all") },
      ...present.map((value) => ({ value, label: t(newsCategory(value).labelKey) })),
    ];
  }, [news, t]);

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
      <PageHero title={t("news.title")}>
        <div className="mx-auto max-w-3xl">
          <SearchInput dark placeholder={t("news.searchPlaceholder")} value={query} onChange={setQuery} />
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
          return (
            <Link key={item.id} to={`/news/${item.id}`} className="motion-card interactive-card flex gap-4 rounded-xl border border-surface-variant bg-surface p-4 text-left shadow-soft transition active:scale-[0.98]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
                <Icon name={meta.icon} filled />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-2 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                  <span className="truncate">{item.source}</span>
                  <span className="shrink-0">{formatDate(item.publishedAt, locale)}</span>
                </span>
                <span className="block text-base font-bold leading-tight text-on-surface">{item.title}</span>
                <span className="mt-2 block line-clamp-3 text-sm leading-5 text-on-surface-variant">{item.summary}</span>
              </span>
            </Link>
          );
        })}
        {newsQuery.isLoading ? (
          <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">{t("common.loading")}</p>
        ) : null}
        {!newsQuery.isLoading && !filteredNews.length ? (
          <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">{t("news.empty")}</p>
        ) : null}
      </main>
      <BottomNav active="news" />
      <Modal open={filtersOpen} title={t("news.filterTitle")} sheet onClose={() => setFiltersOpen(false)}>
        <FilterChips items={categories} selectedValues={selectedCategories} onChange={setSelectedCategories} />
      </Modal>
    </Shell>
  );
}
