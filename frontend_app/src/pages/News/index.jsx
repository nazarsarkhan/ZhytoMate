import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import PageHero from "../../components/layout/PageHero.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Icon from "../../components/ui/Icon.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import { news } from "../../consts/homeData.js";

export default function NewsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);

  const categories = useMemo(
    () => ["all", "utilities", "transport", "official", "events"].map((value) => ({ value, label: t(`categories.${value}`) })),
    [t],
  );

  const filteredNews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return news.filter((item) => {
      const matchesCategory = !selectedCategories.length || selectedCategories.includes(item.category);
      const searchable = `${item.title} ${item.text} ${item.source}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, selectedCategories]);

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
        {filteredNews.map((item) => (
          <button key={item.id} className="motion-card interactive-card flex gap-4 rounded-xl border border-surface-variant bg-surface p-4 text-left shadow-soft transition active:scale-[0.98]" type="button" onClick={() => setSelectedNews(item)}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
              <Icon name={item.icon} filled />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-2 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                <span className="truncate">{item.source}</span>
                <span className="shrink-0">{item.date}</span>
              </span>
              <span className="block text-base font-bold leading-tight text-on-surface">{item.title}</span>
              <span className="mt-2 block text-sm leading-5 text-on-surface-variant">{item.text}</span>
            </span>
          </button>
        ))}
        {!filteredNews.length ? <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">{t("news.empty")}</p> : null}
      </main>
      <BottomNav active="news" />
      <Modal open={filtersOpen} title={t("news.filterTitle")} sheet onClose={() => setFiltersOpen(false)}>
        <FilterChips items={categories} selectedValues={selectedCategories} onChange={setSelectedCategories} />
      </Modal>
      <Modal open={Boolean(selectedNews)} title={t("news.details")} sheet onClose={() => setSelectedNews(null)}>
        {selectedNews ? (
          <article>
            <div className="mb-4 flex items-center gap-3 text-sm text-on-surface-variant">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
                <Icon name={selectedNews.icon} filled />
              </span>
              <span className="min-w-0">
                <span className="block truncate">{selectedNews.source}</span>
                <span className="block">{selectedNews.date}</span>
              </span>
            </div>
            <h3 className="text-xl font-bold text-on-surface">{selectedNews.title}</h3>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">{selectedNews.text}</p>
          </article>
        ) : null}
      </Modal>
    </Shell>
  );
}
