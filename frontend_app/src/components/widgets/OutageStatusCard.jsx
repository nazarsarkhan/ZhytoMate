import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { useOutageSchedule } from "../../hooks/useOutageSchedule.js";
import { OUTAGE_STATUS_META, formatOutageDuration } from "../../consts/outageStatus.js";

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
  const { data, isLoading, isError } = useOutageSchedule();
  const label = "Світло";

  if (isLoading) {
    return <CardFrame to="/services/outages" label={label} icon="bolt" tone="text-on-surface-variant" title="Завантаження..." subtitle="" />;
  }

  if (isError) {
    return <CardFrame to="/services/outages" label={label} icon="power_off" tone="text-on-surface-variant" title="-" subtitle="Графік недоступний" />;
  }

  if (data?.needsAddress) {
    return (
      <CardFrame
        to="/profile"
        label={label}
        icon="wrong_location"
        tone="text-on-surface-variant"
        title="Адресу не вказано"
        subtitle="Додати адресу"
      />
    );
  }

  if (data?.unavailable || !data?.schedule?.now) {
    return <CardFrame to="/services/outages" label={label} icon="power_off" tone="text-on-surface-variant" title="-" subtitle="Графік недоступний" />;
  }

  const { schedule } = data;
  const meta = OUTAGE_STATUS_META[schedule.now.status] || OUTAGE_STATUS_META.on;

  return (
    <CardFrame
      to="/services/outages"
      label={`${label} · Черга ${schedule.queue}`}
      icon={meta.icon}
      tone={meta.tone}
      title={meta.label}
      subtitle={`Зміна через ${formatOutageDuration(schedule.now.nextChangeInMinutes)}`}
    />
  );
}
