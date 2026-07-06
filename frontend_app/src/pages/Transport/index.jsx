import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Icon from "../../components/ui/Icon.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import { routes } from "../../consts/serviceData.js";
import RouteCard from "./components/RouteCard.jsx";

export default function TransportPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState(() => new Set(routes.filter((route) => route.saved).map((route) => route.id)));

  const typeChips = useMemo(
    () => ["all", "tram", "minibus", "trolleybus", "bus"].map((value) => ({ value, label: t(`transport.types.${value}`) })),
    [t],
  );

  const filteredRoutes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return routes.filter((route) => {
      const matchesType = !selectedTypes.length || selectedTypes.includes(route.type);
      const searchable = `${route.number} ${route.title} ${route.type} ${route.direction}`.toLowerCase();
      return matchesType && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, selectedTypes]);

  const toggleSaved = (routeId) => {
    setSavedRoutes((current) => {
      const next = new Set(current);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  return (
    <Shell className="bg-surface pb-28">
      <AppHeader title={t("transport.title")}>
        <div className="mx-auto max-w-3xl">
          <SearchInput dark placeholder={t("transport.searchPlaceholder")} value={query} onChange={setQuery} />
          <div className="mt-4">
            <FilterChips dark items={typeChips} selectedValues={selectedTypes} onChange={setSelectedTypes} />
          </div>
        </div>
      </AppHeader>
      <main className="mx-auto w-full max-w-5xl space-y-section-margin px-container-padding py-section-margin sm:px-6 md:px-8">
        <section className="relative h-36 overflow-hidden rounded-xl border border-surface-variant shadow-sm md:h-52">
          <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDFIcTUrz_vozHgyn2UEI0FVIgvyZvc9PSoUMFiKvLd0WefJsBLkEbSMS7TBtg5xVZ7NTgKbugqmKTOr0b1_0t5s5sgsqikXmw90GvUCAlQfU9XfRcG3Jf03ocFRlVwuDnAJtC7Hi4phWWP0pb9eccM5qV1GSo64atKqo6V2iZ_Pd0ivT683XjJSfl_EAwxBHGDyc_IVVCALaCD6Uzbr0V6RdkdGw6wR7nosmmvVOFev-20mmzomoNcBmY2lJaUwTMzit3EAytT-L4')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-bold text-primary-container">
              <Icon name="map" filled /> {t("transport.liveMap")}
            </div>
            <button className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary active:scale-95" type="button" onClick={() => setMapOpen(true)}>{t("common.open")}</button>
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">{t("transport.nearbyRoutes")}</h2>
            <span className="text-xs text-on-surface-variant">{t("transport.updating")}</span>
          </div>
          <div className="grid grid-cols-1 gap-stack-gap lg:grid-cols-2">
            {filteredRoutes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                saved={savedRoutes.has(route.id)}
                onOpen={() => setSelectedRoute(route)}
                onToggleSaved={() => toggleSaved(route.id)}
              />
            ))}
            {!filteredRoutes.length ? <p className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant lg:col-span-2">{t("transport.empty")}</p> : null}
          </div>
        </section>
      </main>
      <BottomNav active="services" dark />
      <Modal open={mapOpen} title={t("transport.mapTitle")} sheet onClose={() => setMapOpen(false)}>
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-6 text-center">
          <Icon name="map" filled className="text-5xl text-primary-container" />
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">{t("transport.mapText")}</p>
        </div>
      </Modal>
      <Modal open={Boolean(selectedRoute)} title={t("transport.routeDetails")} sheet onClose={() => setSelectedRoute(null)}>
        {selectedRoute ? (
          <article>
            <div className="flex items-start gap-4">
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border text-xl font-bold ${selectedRoute.badge}`}>{selectedRoute.number}</span>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-on-surface">{selectedRoute.title}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
                  <Icon name={selectedRoute.icon} className="text-base" />
                  {t(`transport.types.${selectedRoute.type}`)} · {t("transport.towards")}: {selectedRoute.direction}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedRoute.times.map((time) => (
                <span key={time} className="rounded-md border border-surface-variant bg-surface-container px-3 py-1.5 text-sm text-on-surface-variant">{time}</span>
              ))}
            </div>
          </article>
        ) : null}
      </Modal>
    </Shell>
  );
}
