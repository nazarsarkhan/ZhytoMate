import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useOutageSchedule } from "../../hooks/useOutageSchedule.js";
import {
  OUTAGE_LEGEND_ORDER,
  OUTAGE_STATUS_META,
  formatOutageDuration,
  parseHour,
} from "../../consts/outageStatus.js";
import { formatDate } from "../../lib/formatDate.js";

const ZTOE_URL = "https://www.ztoe.com.ua/unhooking-search.php";

function CurrentStatus({ schedule }) {
  const meta = OUTAGE_STATUS_META[schedule.now.status] || OUTAGE_STATUS_META.on;
  const nextMeta = OUTAGE_STATUS_META[schedule.now.nextStatus] || OUTAGE_STATUS_META.on;

  return (
    <section className={`rounded-2xl border p-5 shadow-soft ${meta.soft}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest/80 px-3 py-1 text-xs font-bold text-on-surface">
          <Icon name="bolt" filled className="text-base text-on-primary-container" /> Черга {schedule.queue}
        </span>
        {schedule.addressLabel ? (
          <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
            <Icon name="home" className="text-sm" /> {schedule.addressLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Icon name={meta.icon} filled className={`text-5xl ${meta.tone}`} />
        <div className="min-w-0">
          <h2 className={`text-2xl font-bold leading-tight ${meta.tone}`}>{meta.label}</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Зміна через {formatOutageDuration(schedule.now.nextChangeInMinutes)}
            {" · "}
            далі {nextMeta.label.toLowerCase()} о {schedule.now.until}
          </p>
        </div>
      </div>

      <p className="mt-4 border-t border-outline-variant/30 pt-3 text-xs text-on-surface-variant">
        Оновлено {formatDate(schedule.updatedAt)}
      </p>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {OUTAGE_LEGEND_ORDER.map((status) => {
        const meta = OUTAGE_STATUS_META[status];
        return (
          <span key={status} className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        );
      })}
    </div>
  );
}

function DayTimeline({ slots }) {
  const offWindows = slots.filter((slot) => slot.status !== "on");

  return (
    <div>
      <div className="flex h-7 gap-px overflow-hidden rounded-lg bg-surface-container">
        {slots.map((slot, index) => (
          <div
            key={index}
            style={{ flexGrow: parseHour(slot.to) - parseHour(slot.from) }}
            className={OUTAGE_STATUS_META[slot.status].bar}
            title={`${slot.from} - ${slot.to}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-on-surface-variant">
        {["00", "06", "12", "18", "24"].map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      {offWindows.length ? (
        <ul className="mt-3 space-y-1.5">
          {offWindows.map((slot, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${OUTAGE_STATUS_META[slot.status].dot}`} />
              <span className="font-semibold text-on-surface">{slot.from} - {slot.to}</span>
              <span className="text-on-surface-variant">· {OUTAGE_STATUS_META[slot.status].label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-600">
          <Icon name="check_circle" filled className="text-lg" /> Планових відключень немає
        </p>
      )}
    </div>
  );
}

function NeedsAddress() {
  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-soft">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed">
        <Icon name="wrong_location" className="text-3xl" />
      </span>
      <h2 className="text-lg font-bold text-on-surface">Адресу не вказано</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-on-surface-variant">Додайте адресу в профілі, і ми визначимо вашу чергу та покажемо графік відключень.</p>
      <Link to="/profile" className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary-container px-6 text-sm font-bold text-on-secondary-container active:scale-[0.98]">
        <Icon name="add_location_alt" className="text-lg" /> Додати адресу
      </Link>
    </section>
  );
}

function Unavailable() {
  return (
    <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
      Дані графіка зараз недоступні. Спробуйте оновити сторінку трохи пізніше.
    </p>
  );
}

export default function OutageSchedulePage() {
  const { data, isLoading, isError } = useOutageSchedule();

  return (
    <Shell className="bg-background pb-28">
      <AppHeader title="Графік відключень" backTo="/services" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto w-full max-w-2xl space-y-section-margin px-container-padding py-section-margin sm:px-6 md:px-8">
        {isLoading ? (
          <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">Завантаження графіка...</p>
        ) : isError ? (
          <p className="rounded-2xl border border-error-container bg-error-container/20 p-6 text-center text-sm text-error">Графік недоступний</p>
        ) : data?.needsAddress ? (
          <NeedsAddress />
        ) : data?.unavailable ? (
          <Unavailable />
        ) : (
          <>
            <CurrentStatus schedule={data.schedule} />
            <Legend />
            {data.schedule.days.map((day) => (
              <section key={day.date} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-base font-bold text-on-surface">{day.label === "today" ? "Сьогодні" : "Завтра"}</h2>
                  <span className="text-xs text-on-surface-variant">{formatDate(day.date)}</span>
                </div>
                <DayTimeline slots={day.slots} />
              </section>
            ))}
            <p className="px-2 text-center text-xs leading-5 text-on-surface-variant">
              Дані отримано з{" "}
              <a href={ZTOE_URL} target="_blank" rel="noreferrer" className="font-semibold text-on-primary-container underline">сайту Житомиробленерго</a>
              {data.schedule.stale ? " · показано останні доступні дані" : ""}
            </p>
          </>
        )}
      </main>
      <BottomNav active="services" />
    </Shell>
  );
}
