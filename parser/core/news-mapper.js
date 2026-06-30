const importanceLabels = new Map([
  [5, 'critical'],
  [4, 'high'],
  [3, 'normal'],
  [2, 'low'],
  [1, 'archive'],
]);

const announcementKeywords = [
  'анонс',
  'відбудеться',
  'запрошу',
  'планується',
  'заплановано',
  'відключення',
  'графік',
  'тимчасово',
];

const criticalKeywords = [
  'евакуац',
  'небезпек',
  'аварі',
  'надзвичайн',
  'масштабн',
  'термінов',
  'штормов',
];

const highKeywords = [
  'відключ',
  'перекрит',
  'транспорт',
  'маршрут',
  'міськрад',
  'рішення',
  'вод',
  'світл',
  'газ',
];

const lowKeywords = [
  'концерт',
  'виставк',
  'театр',
  'фестивал',
  'афіша',
  'дозвілл',
];

const tagKeywords = [
  ['вода', ['вод', 'водопостач']],
  ['світло', ['світл', 'електро']],
  ['газ', ['газ']],
  ['транспорт', ['транспорт', 'маршрут', 'автобус', 'трамва']],
  ['погода', ['погод', 'температур', 'штормов', 'грозов']],
  ['безпека', ['поліці', 'пожеж', 'аварі', 'надзвичайн']],
  ['міськрада', ['міськрад', 'депутат', 'мер', 'рада']],
  ['культура', ['концерт', 'виставк', 'театр', 'фестивал']],
];

function normalizeText(value) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function getBaseText(item) {
  return item.title ? `${item.title}\n\n${item.body || ''}` : item.body || '';
}

function buildTitle(item, ingestRequest) {
  if (item.title) {
    return stripText(item.title).slice(0, 140);
  }

  const firstLine = stripText(ingestRequest.text).split(/[.!?\n]/)[0];
  return (firstLine || `${item.source} update`).slice(0, 140);
}

function buildSummary(text) {
  return stripText(text).slice(0, 280);
}

function inferImportance(text, category) {
  const normalizedText = normalizeText(text);

  if (criticalKeywords.some((keyword) => normalizedText.includes(keyword))) {
    return 5;
  }

  if (category === 'utilities' || highKeywords.some((keyword) => normalizedText.includes(keyword))) {
    return 4;
  }

  if (category === 'culture' || lowKeywords.some((keyword) => normalizedText.includes(keyword))) {
    return 2;
  }

  if (category === 'other') {
    return 2;
  }

  return 3;
}

function inferIsAnnouncement(text) {
  const normalizedText = normalizeText(text);
  return announcementKeywords.some((keyword) => normalizedText.includes(keyword));
}

function inferTags(text, category) {
  const normalizedText = normalizeText(text);
  const tags = new Set();

  if (category && category !== 'other') {
    tags.add(category);
  }

  for (const [tag, keywords] of tagKeywords) {
    if (keywords.some((keyword) => normalizedText.includes(keyword))) {
      tags.add(tag);
    }
  }

  return [...tags].slice(0, 8);
}

function buildExpiresAt(item, ttlDays) {
  const baseDate = new Date(item.publishedAt || Date.now());
  baseDate.setUTCDate(baseDate.getUTCDate() + Number(ttlDays || 7));
  return baseDate.toISOString();
}

export function toNewsItem(item, ingestRequest) {
  const text = getBaseText(item);
  const importance = inferImportance(text, ingestRequest.category);

  return {
    external_id: ingestRequest.document_id,
    source: item.source,
    source_url: item.url || ingestRequest.source,
    title: buildTitle(item, ingestRequest),
    summary: buildSummary(ingestRequest.text),
    body: ingestRequest.text,
    category: ingestRequest.category,
    district: ingestRequest.district,
    importance,
    importance_label: importanceLabels.get(importance),
    is_announcement: inferIsAnnouncement(text),
    event_date: null,
    published_at: item.publishedAt,
    expires_at: buildExpiresAt(item, ingestRequest.ttl_days),
    tags: inferTags(text, ingestRequest.category),
    lang: item.lang,
  };
}
