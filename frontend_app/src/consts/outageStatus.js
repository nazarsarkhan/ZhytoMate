// Shared presentation for the three outage states. Keys mirror OUTAGE_STATUS on the backend.
export const OUTAGE_STATUS_META = {
  on: {
    label: "Світло є",
    icon: "bolt",
    tone: "text-green-600",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    soft: "border-green-200 bg-green-50",
  },
  off: {
    label: "Немає світла",
    icon: "power_off",
    tone: "text-error",
    bar: "bg-red-500",
    dot: "bg-red-500",
    soft: "border-error-container bg-error-container/20",
  },
  maybe: {
    label: "Можливе відключення",
    icon: "schedule",
    tone: "text-amber-600",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    soft: "border-amber-200 bg-amber-50",
  },
};

export const OUTAGE_LEGEND_ORDER = ["off", "maybe", "on"];

export function parseHour(label) {
  return Number(label.slice(0, 2));
}

export function formatOutageDuration(minutes) {
  const safe = Math.max(0, minutes ?? 0);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours && mins) return `${hours} год ${mins} хв`;
  if (hours) return `${hours} год`;
  return `${mins} хв`;
}
