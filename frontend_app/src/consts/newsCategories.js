// Maps the backend/parser news taxonomy (parser/core/ingest/ingest-mapper.js) to a Material
// Symbols icon and an i18n label key. The parser's set is broader than the UI's original filter
// chips, so anything unknown falls back to `other` rather than rendering a blank icon/label.
export const newsCategoryMeta = {
  utilities: { icon: "plumbing", labelKey: "categories.utilities" },
  transport: { icon: "directions_bus", labelKey: "categories.transport" },
  infrastructure: { icon: "construction", labelKey: "categories.infrastructure" },
  ecology: { icon: "eco", labelKey: "categories.ecology" },
  events: { icon: "festival", labelKey: "categories.events" },
  official: { icon: "account_balance", labelKey: "categories.official" },
  memorial: { icon: "local_florist", labelKey: "categories.memorial" },
  weather: { icon: "cloud", labelKey: "categories.weather" },
  economy: { icon: "payments", labelKey: "categories.economy" },
  social: { icon: "groups", labelKey: "categories.social" },
  culture: { icon: "theater_comedy", labelKey: "categories.culture" },
  safety: { icon: "shield", labelKey: "categories.safety" },
  health: { icon: "health_and_safety", labelKey: "categories.health" },
  politics: { icon: "gavel", labelKey: "categories.politics" },
  other: { icon: "newspaper", labelKey: "categories.other" },
};

export function newsCategory(slug) {
  return newsCategoryMeta[slug] || newsCategoryMeta.other;
}
