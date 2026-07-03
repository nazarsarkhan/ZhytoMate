const allowedLangs = new Set(['uk', 'ru']);

const wordChars = '\\p{L}\\p{N}_';

const categoryMatchers = [
  ['memorial', [
    stem('загибл'),
    stem('геро'),
    stem('похорон'),
    stem('похован'),
    stem('прощан'),
    stem('панахид'),
    stem('вшануван'),
    stem('памʼят'),
    stem('пам\'ят'),
    stem('захисник'),
    stem('військовослужб'),
  ]],
  ['utilities', [
    stem('відключ'),
    stem('водопостач'),
    stem('електроенерг'),
    stem('світл'),
    stem('газопостач'),
    stem('опален'),
    stem('комунальн'),
    word('вода'),
    word('газ'),
  ]],
  ['weather', [
    stem('погод'),
    stem('температур'),
    stem('грозов'),
    stem('штормов'),
    word('град'),
    stem('мороз'),
  ]],
  ['economy', [
    stem('корупці'),
    stem('збитк'),
    stem('бюджет'),
    stem('податок'),
    stem('бізнес'),
    stem('ціна'),
  ]],
  ['social', [
    stem('благодійн'),
    stem('волонтер'),
    stem('допомог'),
    stem('збір'),
    stem('громад'),
    stem('переселен'),
    stem('ветеран'),
  ]],
  ['culture', [
    stem('книг'),
    stem('книжк'),
    stem('бібліотек'),
    stem('афіш'),
    stem('концерт'),
    stem('фестивал'),
    stem('виставк'),
    stem('театр'),
  ]],
  ['infrastructure', [
    stem('дорог'),
    stem('ремонт'),
    stem('будівництв'),
    stem('тротуар'),
    stem('освітлен'),
  ]],
  ['transport', [
    word('дтп'),
    stem('автобус'),
    stem('маршрут'),
    stem('транспорт'),
    stem('трамва'),
  ]],
  ['safety', [
    stem('поліці'),
    word('суд'),
    stem('злочин'),
    stem('крадіжк'),
    stem('пожеж'),
    stem('затрим'),
    word('сбу'),
    word('тцк'),
  ]],
  ['health', [
    stem('лікарн'),
    stem('медицин'),
    word('covid'),
    word('грві'),
    stem('хвороб'),
  ]],
  ['economy', [
    word('грн'),
  ]],
  ['politics', [
    stem('міськрад'),
    stem('депутат'),
    stem('петиці'),
    word('мер'),
    word('рада'),
  ]],
  ['ecology', [
    stem('смітт'),
    stem('екологі'),
    stem('вирубк'),
    stem('забруднен'),
  ]],
];

const districtMatchers = [
  ['bohunskyi', [stem('богунськ'), stem('богунк')]],
  ['korolovskyi', [stem('корольовськ'), stem('королівськ')]],
];

const otherCityMatchers = [
  stem('бердичів'),
  stem('коростен'),
  stem('звягел'),
  stem('новоград'),
  stem('малин'),
  stem('овруч'),
  stem('андрушів'),
  stem('радомишл'),
  stem('чуднів'),
  stem('олевськ'),
];

const zhytomyrMatchers = [
  stem('житомир'),
  stem('житомирськ'),
  stem('житомирщин'),
];

const airAlertMatchers = [
  /\u043F\u043E\u0432\u0456\u0442\u0440\u044F\u043D[\p{L}\p{M}'-]*\s+\u0442\u0440\u0438\u0432\u043E\u0433[\p{L}\p{M}'-]*/iu,
  /\u0432\u0456\u0434\u0431\u0456\u0439\s+(?:\u043F\u043E\u0432\u0456\u0442\u0440\u044F\u043D[\p{L}\p{M}'-]*\s+)?\u0442\u0440\u0438\u0432\u043E\u0433[\p{L}\p{M}'-]*/iu,
  /\u0432\u043E\u0437\u0434\u0443\u0448\u043D[\p{L}\p{M}'-]*\s+\u0442\u0440\u0435\u0432\u043E\u0433[\p{L}\p{M}'-]*/iu,
  /\u043E\u0442\u0431\u043E\u0439\s+(?:\u0432\u043E\u0437\u0434\u0443\u0448\u043D[\p{L}\p{M}'-]*\s+)?\u0442\u0440\u0435\u0432\u043E\u0433[\p{L}\p{M}'-]*/iu,
];

const airAlertNewsContextMatchers = [
  /\u043F\u0456\u0434\s+\u0447\u0430\u0441/iu,
  /\u043F\u0456\u0441\u043B\u044F/iu,
  /\u043D\u0430\u0441\u043B\u0456\u0434\u043A[\p{L}\p{M}'-]*/iu,
  /\u043F\u043E\u0448\u043A\u043E\u0434\u0436[\p{L}\p{M}'-]*/iu,
  /\u0437\u0430\u0433\u0438\u043D[\p{L}\p{M}'-]*/iu,
  /\u043F\u043E\u0440\u0430\u043D[\p{L}\p{M}'-]*/iu,
];

const transportMatchers = [
  /\u0442\u0440\u043E\u043B\u0435\u0439\u0431\u0443\u0441[\p{L}\p{M}'-]*/iu,
  /\u0430\u0432\u0442\u043E\u0431\u0443\u0441[\p{L}\p{M}'-]*/iu,
  /\u043C\u0430\u0440\u0448\u0440\u0443\u0442[\p{L}\p{M}'-]*/iu,
  /\u0442\u0440\u0430\u043C\u0432\u0430[\p{L}\p{M}'-]*/iu,
  /\u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442[\p{L}\p{M}'-]*/iu,
];

const shortLivedTransportMatchers = [
  /\u0432\u0456\u0434\u0437\u0430\u0432\u0442\u0440\u0430/iu,
  /\u0437\u0430\u0432\u0442\u0440\u0430/iu,
  /\u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456/iu,
  /\u0442\u0438\u043C\u0447\u0430\u0441\u043E\u0432[\p{L}\p{M}'-]*/iu,
  /\u043A\u0443\u0440\u0441\u0443\u0432\u0430\u0442\u0438\u043C[\p{L}\p{M}'-]*/iu,
  /\u043A\u0443\u0440\u0441\u0443\u044E\u0442[\p{L}\p{M}'-]*/iu,
  /\u0437\u0432\u0438\u0447\u043D[\p{L}\p{M}'-]*\s+\u043C\u0430\u0440\u0448\u0440\u0443\u0442[\p{L}\p{M}'-]*/iu,
];

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bounded(pattern) {
  return new RegExp(`(^|[^${wordChars}])${pattern}(?=$|[^${wordChars}])`, 'iu');
}

function stem(value) {
  return bounded(`${escapeRegExp(value)}[\\p{L}\\p{M}'’ʼ-]*`);
}

function word(value) {
  return bounded(escapeRegExp(value));
}

function hasAny(text, matchers) {
  return matchers.some((matcher) => matcher.test(text));
}

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
  if (item.docType === 'news' || item.docType === 'instruction') {
    return item.docType;
  }

  if (item.type === 'telegram') {
    return 'news';
  }

  if (item.source?.includes('zhitomir-info')) {
    return 'news';
  }

  if (item.source?.includes('zt-rada') || item.url?.includes('zt-rada.gov.ua')) {
    if (item.sourceKind === 'calendar' || item.sourceKind === 'post') {
      return 'news';
    }

    return 'instruction';
  }

  return 'news';
}

function inferCategory(text, item) {
  if (item.category) {
    return item.category;
  }

  const normalizedText = normalizeForSearch(text);

  if (isShortLivedTransportAnnouncement(text)) {
    return 'transport';
  }

  // First match wins. Keep high-impact and false-positive-prone categories
  // earlier than broad civic buckets such as politics.
  for (const [category, matchers] of categoryMatchers) {
    if (hasAny(normalizedText, matchers)) {
      return category;
    }
  }

  return 'other';
}

function inferDistrict(text) {
  const normalizedText = normalizeForSearch(text);

  for (const [district, matchers] of districtMatchers) {
    if (hasAny(normalizedText, matchers)) {
      return district;
    }
  }

  return null;
}

function isOutsideZhytomyrScope(text) {
  const normalizedText = normalizeForSearch(text);
  const mentionsZhytomyr = hasAny(normalizedText, zhytomyrMatchers);
  const mentionsOtherCity = hasAny(normalizedText, otherCityMatchers);

  return mentionsOtherCity && !mentionsZhytomyr;
}

function countSearchWords(text) {
  const words = text.match(/[\p{L}\p{N}_]+/gu);
  return words ? words.length : 0;
}

function isOperationalAirAlertNotice(text) {
  const normalizedText = normalizeForSearch(text);

  if (!hasAny(normalizedText, airAlertMatchers)) {
    return false;
  }

  if (hasAny(normalizedText, airAlertNewsContextMatchers)) {
    return false;
  }

  return countSearchWords(normalizedText) <= 45;
}

function isShortLivedTransportAnnouncement(text) {
  const normalizedText = normalizeForSearch(text);

  if (!hasAny(normalizedText, transportMatchers)) {
    return false;
  }

  if (!hasAny(normalizedText, shortLivedTransportMatchers)) {
    return false;
  }

  return countSearchWords(normalizedText) <= 80;
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

  if (isShortLivedTransportAnnouncement(text)) {
    return 3;
  }

  if (category === 'weather') {
    return 1;
  }

  if (category === 'utilities') {
    return 3;
  }

  if (category === 'memorial' || category === 'social' || category === 'culture') {
    return 14;
  }

  if (category === 'transport' || category === 'safety') {
    const normalizedText = normalizeForSearch(text);

    if (hasAny(normalizedText, [word('дтп'), stem('пожеж'), stem('надзвичайн')])) {
      return 3;
    }

    return 7;
  }

  if (category === 'economy') {
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

  if (isOperationalAirAlertNotice(text)) {
    return {
      skipped: true,
      reason: 'operational air alert notice',
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
