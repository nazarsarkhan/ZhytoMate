// Shared presentation for the three outage states, so the home card and the schedule page render
// the same icon/colour language. Keys ("on" | "off" | "maybe") mirror OUTAGE_STATUS on the backend.
export const OUTAGE_STATUS_META = {
  on: {
    labelKey: "outages.status.on",
    icon: "bolt",
    tone: "text-green-600",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    soft: "border-green-200 bg-green-50",
  },
  off: {
    labelKey: "outages.status.off",
    icon: "power_off",
    tone: "text-error",
    bar: "bg-red-500",
    dot: "bg-red-500",
    soft: "border-error-container bg-error-container/20",
  },
  maybe: {
    labelKey: "outages.status.maybe",
    icon: "schedule",
    tone: "text-amber-600",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    soft: "border-amber-200 bg-amber-50",
  },
};

// Order used in the legend and any status summaries (worst-to-best reads naturally here).
export const OUTAGE_LEGEND_ORDER = ["off", "maybe", "on"];

// Slot times come as "HH:00" strings ("24:00" for end-of-day); the leading two digits are the hour.
export function parseHour(label) {
  return Number(label.slice(0, 2));
}

// "95" -> "1 год 35 хв" style, via i18n unit keys. Never returns a negative duration.
export function formatOutageDuration(minutes, t) {
  const safe = Math.max(0, minutes ?? 0);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours && mins) return t("outages.durationHM", { h: hours, m: mins });
  if (hours) return t("outages.durationH", { h: hours });
  return t("outages.durationM", { m: mins });
}
