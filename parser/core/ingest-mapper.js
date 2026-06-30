const allowedLangs = new Set(['uk', 'ru']);

const categoryKeywords = [
  ['utilities', ['вод', 'світл', 'газ', 'опаленн', 'відключ', 'комунальн']],
  ['weather', ['погод', 'температур', 'грозов', 'штормов', 'град', 'мороз']],
  ['infrastructure', ['дорог', 'ремонт', 'будівництв', 'тротуар', 'освітленн']],
  ['transport', ['дтп', 'автобус', 'маршрут', 'транспорт', 'трамва']],
  ['safety', ['поліці', 'суд', 'злочин', 'крадіжк', 'пожеж', 'затрим', 'сбу', 'тцк']],
  ['health', ['лікарн', 'медицин', 'covid', 'грві', 'хвороб']],
  ['economy', ['ціна', 'бюджет', 'податок', 'бізнес', 'грн']],
  ['politics', ['міськрад', 'депутат', 'петиці', 'мер', 'рада']],
  ['culture', ['афіша', 'концерт', 'фестивал', 'виставк', 'театр']],
  ['ecology', ['сміття', 'екологі', 'вирубк', 'забрудненн']],
];

const districtKeywords = [
  ['bohunskyi', ['богунськ', 'богунк']],
  ['korolovskyi', ['корольовськ', 'королівськ']],
];

const otherCityKeywords = [
  'бердичів',
  'коростен',
  'звягел',
  'новоград',
  'малин',
  'овруч',
  'андрушів',
  'радомишл',
  'чуднів',
  'олевськ',
];

const zhytomyrKeywords = ['житомир', 'житомирськ', 'житомирщин'];

const monthIndexes = new Map([
  ['січня', 0],
  ['лютого', 1],
  ['березня', 2],
  ['квітня', 3],
  ['травня', 4],
  ['червня', 5],
  ['липня', 6],
  ['серпня', 7],
  ['вересня', 8],
  ['жовтня', 9],
  ['листопада', 10],
  ['грудня', 11],
]);

function normalizeForSearch(value) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildText(item) {
  if (item.title) {
    return `${item.title}\n\n${item.body || ''}`;
  }

  return item.body || '';
}

function inferDocType(item) {
  if (item.type === 'telegram') {
    return 'news';
  }

  if (item.source?.includes('zhitomir-info')) {
    return 'news';
  }

  if (item.source?.includes('zt-rada') || item.url?.includes('zt-rada.gov.ua')) {
    return item.url?.includes('pages=') ? 'news' : 'instruction';
  }

  return 'news';
}

function inferCategory(text, item) {
  if (item.category) {
    return item.category;
  }

  const normalizedText = normalizeForSearch(text);

  for (const [category, keywords] of categoryKeywords) {
    if (keywords.some((keyword) => normalizedText.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}

function inferDistrict(text) {
  const normalizedText = normalizeForSearch(text);

  for (const [district, keywords] of districtKeywords) {
    if (keywords.some((keyword) => normalizedText.includes(keyword))) {
      return district;
    }
  }

  return null;
}

function isOutsideZhytomyrScope(text) {
  const normalizedText = normalizeForSearch(text);
  const mentionsZhytomyr = zhytomyrKeywords.some((keyword) => normalizedText.includes(keyword));
  const mentionsOtherCity = otherCityKeywords.some((keyword) => normalizedText.includes(keyword));

  return mentionsOtherCity && !mentionsZhytomyr;
}

function parseNumericDates(text, publishedAt) {
  const dates = [];
  const publishedDate = new Date(publishedAt);
  const year = publishedDate.getUTCFullYear();
  const regex = /\b([0-3]?\d)[./-]([01]?\d)(?:[./-](20\d{2}))?\b/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const parsedYear = match[3] ? Number(match[3]) : year;

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      dates.push(new Date(Date.UTC(parsedYear, month, day)));
    }
  }

  return dates;
}

function parseUkrainianMonthDates(text, publishedAt) {
  const dates = [];
  const publishedDate = new Date(publishedAt);
  const year = publishedDate.getUTCFullYear();
  const regex = /\b([0-3]?\d)\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)(?:\s+(20\d{2}))?\b/giu;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const day = Number(match[1]);
    const month = monthIndexes.get(match[2].toLowerCase());
    const parsedYear = match[3] ? Number(match[3]) : year;

    if (day >= 1 && day <= 31 && month !== undefined) {
      dates.push(new Date(Date.UTC(parsedYear, month, day)));
    }
  }

  return dates;
}

function findFutureDate(text, publishedAt) {
  const publishedDate = new Date(publishedAt);
  const dates = [
    ...parseNumericDates(text, publishedAt),
    ...parseUkrainianMonthDates(text, publishedAt),
  ];

  return dates
    .filter((date) => date > publishedDate)
    .sort((a, b) => a - b)[0] || null;
}

function daysUntil(date, publishedAt) {
  const publishedDate = new Date(publishedAt);
  const diffMs = date.getTime() - publishedDate.getTime();
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)) + 1);
}

function inferTtlDays(text, category, publishedAt) {
  const futureDate = findFutureDate(text, publishedAt);

  if (futureDate) {
    return daysUntil(futureDate, publishedAt);
  }

  if (category === 'weather') {
    return 1;
  }

  if (category === 'utilities') {
    return 3;
  }

  if (category === 'transport' || category === 'safety') {
    const normalizedText = normalizeForSearch(text);

    if (['дтп', 'пожеж', 'надзвичайн'].some((keyword) => normalizedText.includes(keyword))) {
      return 3;
    }

    return 7;
  }

  if (category === 'economy' || category === 'culture') {
    return 14;
  }

  if (category === 'politics') {
    return 30;
  }

  return 7;
}

export function toIngestRequest(item) {
  if (!allowedLangs.has(item.lang)) {
    return {
      skipped: true,
      reason: `unsupported language: ${item.lang}`,
      request: null,
    };
  }

  const text = buildText(item);

  if (!text.trim()) {
    return {
      skipped: true,
      reason: 'empty text',
      request: null,
    };
  }

  if (isOutsideZhytomyrScope(text)) {
    return {
      skipped: true,
      reason: 'outside Zhytomyr city scope',
      request: null,
    };
  }

  const category = inferCategory(text, item);

  return {
    skipped: false,
    reason: null,
    request: {
      document_id: `${item.source}_${item.id}`,
      text,
      doc_type: inferDocType(item),
      source: item.url || item.source,
      category,
      district: inferDistrict(text),
      ttl_days: inferTtlDays(text, category, item.publishedAt),
    },
  };
}
