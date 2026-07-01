const importanceLabels = new Map([
  [5, 'critical'],
  [4, 'high'],
  [3, 'normal'],
  [2, 'low'],
  [1, 'archive'],
]);

const wordChars = '\\p{L}\\p{N}_';

const announcementMatchers = [
  stem('анонс'),
  stem('відбудеться'),
  stem('запрошу'),
  stem('планується'),
  stem('заплановано'),
  stem('відключення'),
  stem('графік'),
  stem('тимчасово'),
  stem('прощан'),
  stem('похорон'),
  stem('похован'),
];

const criticalMatchers = [
  stem('евакуац'),
  stem('небезпек'),
  stem('аварі'),
  stem('надзвичайн'),
  stem('масштабн'),
  stem('термінов'),
  stem('штормов'),
];

const highMatchers = [
  stem('відключ'),
  stem('перекрит'),
  stem('транспорт'),
  stem('маршрут'),
  stem('міськрад'),
  stem('рішення'),
  stem('водопостач'),
  stem('світл'),
  stem('газопостач'),
  stem('похорон'),
  stem('прощан'),
  stem('загибл'),
];

const lowMatchers = [
  stem('концерт'),
  stem('виставк'),
  stem('театр'),
  stem('фестивал'),
  stem('афіш'),
  stem('дозвілл'),
];

const tagMatchers = [
  ['memorial', [stem('загибл'), stem('геро'), stem('похорон'), stem('прощан'), stem('вшануван')]],
  ['вода', [stem('водопостач'), word('вода')]],
  ['світло', [stem('світл'), stem('електро')]],
  ['газ', [stem('газопостач'), word('газ')]],
  ['транспорт', [stem('транспорт'), stem('маршрут'), stem('автобус'), stem('трамва')]],
  ['погода', [stem('погод'), stem('температур'), stem('штормов'), stem('грозов')]],
  ['безпека', [stem('поліці'), stem('пожеж'), stem('аварі'), stem('надзвичайн')]],
  ['міськрада', [stem('міськрад'), stem('депутат'), word('мер'), word('рада')]],
  ['культура', [stem('книг'), stem('книжк'), stem('концерт'), stem('виставк'), stem('театр'), stem('фестивал')]],
  ['соціальне', [stem('благодійн'), stem('волонтер'), stem('допомог'), stem('збір')]],
];

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

  if (hasAny(normalizedText, criticalMatchers)) {
    return 5;
  }

  if (
    category === 'utilities'
    || category === 'memorial'
    || hasAny(normalizedText, highMatchers)
  ) {
    return 4;
  }

  if (category === 'culture' || hasAny(normalizedText, lowMatchers)) {
    return 2;
  }

  if (category === 'other') {
    return 2;
  }

  return 3;
}

function inferIsAnnouncement(text, category) {
  const normalizedText = normalizeText(text);
  return category === 'memorial' || hasAny(normalizedText, announcementMatchers);
}

function inferTags(text, category) {
  const normalizedText = normalizeText(text);
  const tags = new Set();

  if (category && category !== 'other') {
    tags.add(category);
  }

  for (const [tag, matchers] of tagMatchers) {
    if (hasAny(normalizedText, matchers)) {
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
    is_announcement: inferIsAnnouncement(text, ingestRequest.category),
    event_date: null,
    published_at: item.publishedAt,
    expires_at: buildExpiresAt(item, ingestRequest.ttl_days),
    tags: inferTags(text, ingestRequest.category),
    lang: item.lang,
  };
}
