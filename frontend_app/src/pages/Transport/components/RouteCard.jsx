import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon.jsx";

export default function RouteCard({ route, saved, onToggleSaved, onOpen }) {
  const { t } = useTranslation();
  const statusLabel = route.status ? t(`transport.status.${route.status}`) : "";
  const isDelayed = route.status === "delayed";
  const statusClass = isDelayed ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700";
  const statusIcon = isDelayed ? "warning" : "check_circle";

  return (
    <article className="rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-soft">
      <div className="flex gap-4">
        <button className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-lg font-bold ${route.badge}`} type="button" onClick={onOpen}>
          {route.number}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <button className="min-w-0 flex-1 truncate text-left font-bold text-on-surface" type="button" onClick={onOpen}>
              {route.title}
            </button>
            <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-surface-container active:scale-95" type="button" onClick={onToggleSaved}>
              <Icon name={saved ? "bookmark" : "bookmark_border"} filled={saved} className={saved ? "text-secondary-container" : "text-outline"} />
            </button>
          </div>
          <button className="flex w-full min-w-0 max-w-full items-center gap-2 text-left text-xs text-on-surface-variant" type="button" onClick={onOpen}>
            <Icon name={route.icon} className="text-base" />
            <span>{t(`transport.types.${route.type}`)}</span>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <span className="truncate">{t("transport.towards")}: {route.direction}</span>
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {route.times.map((time, index) => {
              const isNextArrival = index === 0 && !isDelayed;
              const isDelayedHighlight = index === 1 && isDelayed;
              let chipClass = "border-surface-variant bg-surface-container text-on-surface-variant";
              if (isNextArrival) chipClass = "border-green-100 bg-green-50 font-bold text-green-700";
              else if (isDelayedHighlight) chipClass = "border-orange-100 bg-orange-50 font-bold text-orange-700";
              return (
                <span key={time} className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${chipClass}`}>
                  {isNextArrival ? <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" /> : null}
                  {time}
                </span>
              );
            })}
            {statusLabel ? (
              <span className={`ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs font-bold ${statusClass}`}>
                <Icon name={statusIcon} filled className="text-sm" /> {statusLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
