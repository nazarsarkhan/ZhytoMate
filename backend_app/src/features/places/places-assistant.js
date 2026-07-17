const INTENTS = [
  ['food', /(кафе|кофе|ресторан|поесть|їсти|їжа|кав'яр)/i],
  ['shopping', /(супермаркет|магазин|купить|купити|продукт|вода|ринок)/i],
  ['health', /(аптек|лікар|врач|больниц|лікарн)/i],
  ['transport', /(тролейбус|троллейбус|маршрут|маршрутка|автобус|зупин|останов)/i],
  ['culture', /(музе[йеию]|театр|кіно|кино|библиотек|бібліотек|галере|выставк|виставк)/i],
];

const TRANSPORT_QUERY = /(?:маршрут\w*|маршрутка\w*|тролейбус\w*|троллейбус\w*|автобус\w*|транспорт\w*|зупин\w*|останов\w*|розклад\w*|расписани\w*|доїх\w*|добрат\w*|доехать|добраться|пересад\w*)/iu;
const MAX_INLINE_PLACES = 5;

export function isExplicitlyNonLocalPlaceQuery(query) {
  return /(?<!\p{L})(?:марс(?:і|е)?|луна|космос(?:і|е)?)(?!\p{L})/iu.test(query);
}

export function detectTransportRouteQuery(query) {
  return TRANSPORT_QUERY.test(query);
}

export function hasTransportRouteNumber(query) {
  return /\b\d{1,3}[a-zа-я]?(?:\b|$)/iu.test(query);
}

export function detectPlaceQuery(query) {
  if (isExplicitlyNonLocalPlaceQuery(query)) return null;
  const match = INTENTS.find(([, pattern]) => pattern.test(query));
  return match ? { category: match[0] } : null;
}

export function formatPlaceAnswer(items) {
  if (!items?.length) return null;
  const lines = items.slice(0, MAX_INLINE_PLACES).map((item, index) => {
    const details = [item.address, item.phone, item.openingHours].filter(Boolean).join(' · ');
    return `${index + 1}. ${item.name}${details ? ` — ${details}` : ''}\n   ${item.sourceUrl}`;
  });
  return `Ось що знайшов у Житомирі:\n${lines.join('\n')}\n\nДані OpenStreetMap; перевіряйте актуальність перед поїздкою.`;
}

export function formatTransportFallbackAnswer(query = '') {
  const russian = /\b(мне|где|как|доехать|остановк|расписани|троллейбус|маршрутка)\b/i.test(query);
  return russian
    ? 'Точный маршрут по этому направлению не удалось подтвердить. Откройте раздел «Транспорт» ниже: там доступны маршруты, остановки и актуальное движение по Житомиру.'
    : 'Точний маршрут за цим напрямком не вдалося підтвердити. Відкрийте розділ «Транспорт» нижче: там доступні маршрути, зупинки та актуальний рух Житомиром.';
}

export default {
  detectPlaceQuery,
  isExplicitlyNonLocalPlaceQuery,
  detectTransportRouteQuery,
  hasTransportRouteNumber,
  formatPlaceAnswer,
  formatTransportFallbackAnswer,
};
