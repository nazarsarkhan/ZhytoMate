// Maps the backend/parser news taxonomy to a Material Symbols icon and a Ukrainian label.
export const newsCategoryMeta = {
  utilities: { icon: "plumbing", label: "Комуналка" },
  transport: { icon: "directions_bus", label: "Транспорт" },
  infrastructure: { icon: "construction", label: "Інфраструктура" },
  ecology: { icon: "eco", label: "Екологія" },
  events: { icon: "festival", label: "Події" },
  official: { icon: "account_balance", label: "Офіційно" },
  memorial: { icon: "local_florist", label: "Вшанування" },
  weather: { icon: "cloud", label: "Погода" },
  economy: { icon: "payments", label: "Економіка" },
  social: { icon: "groups", label: "Соціальне" },
  culture: { icon: "theater_comedy", label: "Культура" },
  safety: { icon: "shield", label: "Безпека" },
  health: { icon: "health_and_safety", label: "Здоров'я" },
  politics: { icon: "gavel", label: "Політика" },
  other: { icon: "newspaper", label: "Інше" },
};

export function newsCategory(slug) {
  return newsCategoryMeta[slug] || newsCategoryMeta.other;
}
