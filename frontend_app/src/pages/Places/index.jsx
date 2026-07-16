import { useMemo, useState } from "react";
import Shell from "../../components/layout/Shell.jsx";
import PageHero from "../../components/layout/PageHero.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { usePlaces } from "../../hooks/usePlaces.js";

const categories = [
  ["", "Усі"], ["food", "Їжа"], ["shopping", "Магазини"], ["health", "Медицина"],
  ["government", "Установи"], ["services", "Послуги"], ["culture", "Культура"],
];

function mapUrl(place) {
  return `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`;
}

export default function PlacesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const { data, isLoading, isError } = usePlaces({ query, category });
  const places = useMemo(() => data?.items || [], [data]);

  return (
    <Shell className="bg-background pb-28">
      <PageHero title="Місця Житомира">
        <div className="mx-auto max-w-3xl">
          <SearchInput dark placeholder="Кафе, аптека, суд, магазин..." value={query} onChange={setQuery} />
        </div>
      </PageHero>
      <main className="mx-auto w-full max-w-6xl px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {categories.map(([value, label]) => (
            <button key={value || "all"} type="button" onClick={() => setCategory(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${category === value ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
              {label}
            </button>
          ))}
        </div>
        {isLoading ? <p className="rounded-xl bg-surface-container-low p-6 text-center">Завантаження...</p> : null}
        {isError ? <p className="rounded-xl border border-error-container bg-error-container/30 p-6 text-center text-error">Не вдалося завантажити місця.</p> : null}
        {!isLoading && !isError && !places.length ? <p className="rounded-xl bg-surface-container-low p-6 text-center text-on-surface-variant">Нічого не знайдено.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((place) => (
            <article key={place.sourceId} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed"><Icon name="location_on" filled /></span>
                <div className="min-w-0"><h2 className="font-bold text-on-surface">{place.name}</h2><p className="mt-1 text-xs text-on-surface-variant">{place.address || "Адреса не вказана"}</p></div>
              </div>
              {place.openingHours ? <p className="mt-3 text-xs text-on-surface-variant">Години: {place.openingHours}</p> : null}
              <div className="mt-4 flex items-center gap-2">
                <a className="flex-1 rounded-full bg-primary-container px-3 py-2 text-center text-xs font-bold text-on-primary-container" href={mapUrl(place)} target="_blank" rel="noreferrer">Відкрити на карті</a>
                {place.phone ? <a className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container" href={`tel:${place.phone}`} aria-label={`Зателефонувати: ${place.phone}`}><Icon name="call" /></a> : null}
              </div>
              <a className="mt-3 block text-[11px] text-on-surface-variant underline" href={place.sourceUrl} target="_blank" rel="noreferrer">Дані OpenStreetMap</a>
            </article>
          ))}
        </div>
        {data?.catalogUpdatedAt ? <p className="mt-6 text-center text-xs text-on-surface-variant">Каталог оновлено: {new Date(data.catalogUpdatedAt).toLocaleString("uk-UA")}</p> : null}
      </main>
      <BottomNav active="services" dark />
    </Shell>
  );
}
