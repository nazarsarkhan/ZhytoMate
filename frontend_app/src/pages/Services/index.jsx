import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import PageHero from "../../components/layout/PageHero.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import { serviceCards } from "../../consts/serviceData.js";

export default function ServicesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return serviceCards.filter((card) => {
      const title = t(card.titleKey).toLowerCase();
      const subtitle = t(card.subtitleKey).toLowerCase();
      return !normalizedQuery || `${title} ${subtitle}`.includes(normalizedQuery);
    });
  }, [query, t]);

  return (
    <Shell className="bg-background pb-28">
      <PageHero title={t("services.title")}>
        <div className="mx-auto max-w-3xl">
          <SearchInput dark placeholder={t("services.searchPlaceholder")} value={query} onChange={setQuery} />
        </div>
      </PageHero>
      <main className="mx-auto w-full max-w-5xl px-container-padding py-section-margin sm:px-6 md:px-8">
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {filteredCards.map((card) => (
            <Link key={card.id} to={card.href} className="motion-card interactive-card flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-surface-variant/60 bg-surface-container-lowest p-4 text-center shadow-soft transition active:scale-[0.98]">
              <span className={`flex h-14 w-14 items-center justify-center rounded-full ${card.tone}`}>
                <Icon name={card.icon} filled className="text-3xl" />
              </span>
              <span>
                <span className="block text-base font-bold text-primary">{t(card.titleKey)}</span>
                <span className="mt-1 block text-xs text-on-surface-variant">{t(card.subtitleKey)}</span>
              </span>
            </Link>
          ))}
          {!filteredCards.length ? <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">{t("services.empty")}</p> : null}
        </section>
      </main>
      <BottomNav active="services" dark />
    </Shell>
  );
}
