const LATEST_NEWS_RE = /(?:останні|останніх|последн(?:ие|их)|свіж(?:і|их)|актуальн(?:і|их))\s+нов(?:ин|ост)|новини\s+(?:міста|житомира|сьогодні)|новост(?:и|ей)\s+(?:города|житомира|сегодня)|что нового/i;

export function detectLatestNewsQuery(query) {
  return LATEST_NEWS_RE.test(query);
}

export function formatLatestNewsAnswer(items) {
  if (!items?.length) return null;
  const lines = items.slice(0, 5).map((item, index) => {
    const date = item.publishedAt ? ` (${new Date(item.publishedAt).toLocaleDateString('uk-UA')})` : '';
    const fullTitle = String(item.title || '').replace(/\s+/g, ' ').trim();
    const title = fullTitle.slice(0, 120);
    const rawSummary = String(item.summary || '').replace(/\s+/g, ' ').trim();
    // Parser summaries often begin with the headline itself. Do not render that same headline
    // twice in a compact assistant message.
    const summary = rawSummary.toLocaleLowerCase('uk-UA').startsWith(fullTitle.toLocaleLowerCase('uk-UA'))
      ? ''
      : rawSummary.slice(0, 150);
    return `${index + 1}. ${title}${date}${summary ? `\n   ${summary}` : ''}`;
  });
  return `Останні новини Житомира:\n${lines.join('\n')}`;
}

export default { detectLatestNewsQuery, formatLatestNewsAnswer };
