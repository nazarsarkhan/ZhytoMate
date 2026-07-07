export function formatDate(isoString, locale = "uk-UA") {
  if (!isoString) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(isoString));
}
