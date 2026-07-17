import Icon from "../ui/Icon.jsx";
import { useAirAlertStatus } from "../../hooks/useAirAlertStatus.js";

const CARD_CLASS =
  "motion-card interactive-card flex min-h-[136px] w-[82%] max-w-[320px] shrink-0 snap-center flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3.5 shadow-sm sm:w-[46%] sm:p-4 md:min-h-40 md:w-auto md:max-w-none md:p-4";

function getStatusMeta(data, isLoading, isError) {
  if (isLoading) {
    return { icon: "security", tone: "text-on-surface-variant", title: "Завантаження...", text: "" };
  }

  if (isError || !data?.available || data.status === "unknown") {
    return {
      icon: "help_outline",
      tone: "text-on-surface-variant",
      title: "Дані недоступні",
      text: "Перевірте офіційні канали",
    };
  }

  if (data.status === "active") {
    return {
      icon: "warning",
      tone: "text-red-600",
      title: "Повітряна тривога",
      text: "Прямуйте в укриття",
    };
  }

  if (data.status === "partial") {
    return {
      icon: "warning",
      tone: "text-amber-600",
      title: "Часткова тривога",
      text: "Перевірте повідомлення",
    };
  }

  return {
    icon: "security",
    tone: "text-green-600",
    title: "Тривоги немає",
    text: "Безпечно за даними ubilling.net.ua",
  };
}

export default function AirAlertStatusCard() {
  const { data, isLoading, isError } = useAirAlertStatus();
  const meta = getStatusMeta(data, isLoading, isError);

  return (
    <article className={CARD_CLASS}>
      <span className="mb-3 block text-xs font-medium leading-snug text-on-surface-variant">
        Повітряна тривога · Житомир
      </span>
      <div className="flex min-h-0 flex-1 items-start gap-3 md:flex-col md:justify-end">
        <Icon name={meta.icon} filled className={`float-soft icon-display shrink-0 text-[36px] sm:text-[40px] md:text-[46px] ${meta.tone}`} />
        <div className="min-w-0 flex-1 md:w-full md:flex-none">
          <h2 className="max-w-full break-words text-xl font-bold leading-tight text-on-surface sm:text-2xl md:text-xl">
            {meta.title}
          </h2>
          <p className={`mt-1 max-w-full break-words text-xs font-medium leading-snug ${meta.tone}`}>
            {meta.text}
          </p>
        </div>
      </div>
    </article>
  );
}
