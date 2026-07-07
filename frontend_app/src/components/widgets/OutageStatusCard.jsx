import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon.jsx";
import { useOutageSchedule } from "../../hooks/useOutageSchedule.js";
import { OUTAGE_STATUS_META, formatOutageDuration } from "../../consts/outageStatus.js";

// Matches the sibling status <article> on the home screen (see statusCards in Assistant/index.jsx)
// so the row stays visually uniform - this one is just live and clickable.
const CARD_CLASS =
  "motion-card interactive-card flex min-h-[136px] w-[82%] max-w-[320px] shrink-0 snap-center flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3.5 shadow-sm sm:w-[46%] sm:p-4 md:min-h-40 md:w-auto md:max-w-none md:p-5";

function CardFrame({ to, label, icon, tone, title, subtitle }) {
  return (
    <Link to={to} className={CARD_CLASS}>
      <span className="mb-3 block truncate text-xs font-medium text-on-surface-variant">{label}</span>
      <div className="flex min-h-0 flex-1 items-start gap-3 md:flex-col md:justify-end">
        <Icon name={icon} filled className={`float-soft icon-display shrink-0 text-[36px] sm:text-[40px] md:text-[46px] ${tone}`} />
        <div className="min-w-0 flex-1 md:w-full md:flex-none">
          <h2 className="max-w-full break-words text-xl font-bold leading-tight text-on-surface sm:text-2xl md:truncate md:text-2xl">{title}</h2>
          <p className={`mt-1 max-w-full break-words text-xs font-medium leading-snug md:truncate ${tone}`}>{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}

export default function OutageStatusCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useOutageSchedule();
  const label = t("outages.cardLabel");

  if (isLoading) {
    return <CardFrame to="/services/outages" label={label} icon="bolt" tone="text-on-surface-variant" title={t("outages.cardLoading")} subtitle="" />;
  }

  if (isError) {
    return <CardFrame to="/services/outages" label={label} icon="power_off" tone="text-on-surface-variant" title="—" subtitle={t("outages.unavailable")} />;
  }

  if (data?.needsAddress) {
    return (
      <CardFrame
        to="/profile"
        label={label}
        icon="wrong_location"
        tone="text-on-surface-variant"
        title={t("outages.needsAddressTitle")}
        subtitle={t("outages.needsAddressCta")}
      />
    );
  }

  const { schedule } = data;
  const meta = OUTAGE_STATUS_META[schedule.now.status] || OUTAGE_STATUS_META.on;

  return (
    <CardFrame
      to="/services/outages"
      label={`${label} · ${t("outages.queue", { queue: schedule.queue })}`}
      icon={meta.icon}
      tone={meta.tone}
      title={t(meta.labelKey)}
      subtitle={t("outages.changeIn", { time: formatOutageDuration(schedule.now.nextChangeInMinutes, t) })}
    />
  );
}
