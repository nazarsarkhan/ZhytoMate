export function formatDate(isoString, locale) {
  if (!isoString) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(isoString));
}
