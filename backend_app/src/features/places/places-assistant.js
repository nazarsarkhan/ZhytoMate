const INTENTS = [
  ['food', /(кафе|кофе|ресторан|поесть|їсти|їжа|кав'яр)/i],
  ['shopping', /(супермаркет|магазин|купить|купити|продукт|вода|ринок)/i],
  ['health', /(аптек|лікар|врач|больниц|лікарн)/i],
  ['transport', /(тролейбус|троллейбус|маршрут|маршрутка|автобус|зупин|останов)/i],
  ['culture', /(музе[йеию]|театр|кіно|кино|библиотек|бібліотек|галере|выставк|виставк)/i],
];

const TRANSPORT_QUERY = /(?:маршрут\w*|маршрутка\w*|тролейбус\w*|троллейбус\w*|автобус\w*|транспорт\w*|зупин\w*|останов\w*|розклад\w*|расписани\w*|доїх\w*|добрат\w*|доехать|добраться|пересад\w*)/iu;

export function detectTransportRouteQuery(query) {
  return TRANSPORT_QUERY.test(query);
}

export function detectPlaceQuery(query) {
  const match = INTENTS.find(([, pattern]) => pattern.test(query));
  return match ? { category: match[0] } : null;
}

export function formatPlaceAnswer(items) {
  if (!items?.length) return null;
  const lines = items.slice(0, 10).map((item, index) => {
    const details = [item.address, item.phone, item.openingHours].filter(Boolean).join(' · ');
    return `${index + 1}. ${item.name}${details ? ` — ${details}` : ''}\n   ${item.sourceUrl}`;
  });
  return `Ось що знайшов у Житомирі:\n${lines.join('\n')}\n\nДані OpenStreetMap; перевіряйте актуальність перед поїздкою.`;
}

export default { detectPlaceQuery, detectTransportRouteQuery, formatPlaceAnswer };
