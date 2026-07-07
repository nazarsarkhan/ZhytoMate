import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { appealCategories, appealStatusTone } from "../../consts/appealCategories.js";
import { useAppeals } from "../../hooks/useAppeals.js";
import { formatDate } from "../../lib/formatDate.js";
import AppealFormModal from "./components/AppealFormModal.jsx";

function categoryLabelKey(slug) {
  return appealCategories.find((category) => category.slug === slug)?.labelKey || "appeals.categories.other";
}

export default function AppealsPage() {
  const { t, i18n } = useTranslation();
  const appealsQuery = useAppeals();
  const appeals = appealsQuery.data || [];
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  const statusItems = [
    { value: "all", label: t("common.all") },
    ...Array.from(new Set(appeals.map((item) => item.status))).map((status) => ({ value: status, label: t(`appeals.status.${status}`) })),
  ];
  const filteredAppeals = selectedStatuses.length ? appeals.filter((item) => selectedStatuses.includes(item.status)) : appeals;

  return (
    <Shell className="bg-background pb-28">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-primary-container px-container-padding pb-4 pt-[calc(16px+var(--safe-top))] text-on-primary shadow-sm sm:px-6 md:px-8">
        <Icon name="account_balance" className="text-primary-fixed-dim" />
        <h1 className="text-lg font-bold md:text-2xl">{t("app.name")}</h1>
        <Icon name="notifications" className="text-primary-fixed-dim" />
      </header>
      <main className="mx-auto w-full max-w-5xl">
        <section className="rounded-b-3xl bg-primary-container px-container-padding pb-8 pt-6 text-on-primary shadow-sm sm:px-6 md:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold">{t("appeals.title")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-fixed-dim">{t("appeals.subtitle")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {appealCategories.slice(0, 4).map((category) => (
                <span key={category.slug} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">{t(category.labelKey)}</span>
              ))}
            </div>
            <button className="mt-6 flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-sm active:scale-95" type="button" onClick={() => setOpen(true)}>
              <Icon name="add_circle" filled /> {t("appeals.create")}
            </button>
          </div>
        </section>
        <section className="px-container-padding py-section-margin sm:px-6 md:px-8">
          <div className="mb-4 flex items-end justify-between">
            <h3 className="text-lg font-bold text-on-surface">{t("appeals.history")}</h3>
            <button className="flex items-center gap-1 text-xs font-bold text-on-tertiary-fixed-variant" type="button" onClick={() => setFiltersOpen(true)}>{t("common.filter")} <Icon name="filter_list" className="text-lg" /></button>
          </div>
          <div className="grid gap-stack-gap md:grid-cols-2">
            {filteredAppeals.map((item) => (
              <Link
                key={item.id}
                to={`/services/appeals/${item.id}`}
                className="motion-card block rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft transition hover:border-primary-container active:scale-[0.99]"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs text-on-surface-variant"><Icon name="calendar_today" className="text-base" /> {formatDate(item.createdAt, i18n.resolvedLanguage)}</span>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${appealStatusTone[item.status] || appealStatusTone.new}`}>{t(`appeals.status.${item.status}`)}</span>
                </div>
                <h4 className="text-lg font-bold text-on-surface">{t(categoryLabelKey(item.category))}</h4>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">{item.description}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low px-2 py-1.5 text-xs text-on-surface-variant">
                  <Icon name="location_on" className="text-base" /> {item.address}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/20 pt-3">
                  {item.response ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700"><Icon name="mark_chat_read" className="text-base" /> {t("appeals.detail.hasResponse")}</span>
                  ) : <span />}
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">{t("appeals.detail.open")} <Icon name="arrow_forward" className="text-base" /></span>
                </div>
              </Link>
            ))}
            {!filteredAppeals.length ? <p className="col-span-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">{t("appeals.empty")}</p> : null}
          </div>
        </section>
      </main>
      <BottomNav active="services" />
      <AppealFormModal open={open} onClose={() => setOpen(false)} />
      <Modal open={filtersOpen} title={t("common.filters")} sheet onClose={() => setFiltersOpen(false)}>
        <FilterChips items={statusItems} selectedValues={selectedStatuses} onChange={setSelectedStatuses} />
      </Modal>
    </Shell>
  );
}
