import { load } from 'cheerio';
import pLimit from 'p-limit';
import { fetchText } from '../../core/web/http-client.js';

const BASE_URL = 'https://www.zhitomir.info/';
const NEWS_URL = `${BASE_URL}news.html`;
const CONFIG = {
  enabled: true,
  schedule: '*/30 * * * *',
  maxItems: 30,
  concurrency: 4,
};

const ukrainianMonths = new Map([
  ['січня', '01'],
  ['лютого', '02'],
  ['березня', '03'],
  ['квітня', '04'],
  ['травня', '05'],
  ['червня', '06'],
  ['липня', '07'],
  ['серпня', '08'],
  ['вересня', '09'],
  ['жовтня', '10'],
  ['листопада', '11'],
  ['грудня', '12'],
]);

export function parsePublishedAt(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const numericMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})[ ,]+(\d{1,2}):(\d{2})/);
  const ukrainianMatch = text.match(
    /(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})[ ,]+(\d{1,2}):(\d{2})/iu,
  );
  const match = numericMatch || ukrainianMatch;

  if (!match) {
    return new Date().toISOString();
  }

  const [, day, monthValue, year, hours, minutes] = match;
  const month = numericMatch ? monthValue.padStart(2, '0') : ukrainianMonths.get(monthValue.toLowerCase());

  if (!month) {
    return new Date().toISOString();
  }

  const parsed = new Date(`${year}-${month}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function fetchArticle(url, titleFromList) {
  const { text } = await fetchText(url);
  const $ = load(text);
  const title = $('.news-title-full').first().text().replace(/\s+/g, ' ').trim() || titleFromList;
  const publishedText = $('.news-date-full, .news-date').first().text().replace(/\s+/g, ' ').trim();
  const content = $('.news-full-content .text, article, .news-text-full, .news-content, main').first();
  content.find('script, style, nav, header, footer, .advert, .social').remove();
  const body = content.text().replace(/\s+/g, ' ').trim();
  if (!title || body.length < 80) return null;
  return {
    url,
    title,
    body: `${title}. ${body}`.slice(0, 50000),
    publishedAt: parsePublishedAt(publishedText),
  };
}

export default {
  id: 'zhytomir-info',
  schedule: CONFIG.schedule,
  enabled: CONFIG.enabled,
  settings: CONFIG,

  async fetch() {
    const { text } = await fetchText(NEWS_URL);
    const $ = load(text);
    const linkMap = new Map();
    $('a[href^="/news_"]').each((_index, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().replace(/\s+/g, ' ').trim();
      if (href && title) {
        linkMap.set(href, { url: new URL(href, BASE_URL).toString(), title });
      }
    });
    const links = [...linkMap.values()].slice(0, CONFIG.maxItems);
    const limit = pLimit(CONFIG.concurrency);
    return (await Promise.all([...links].map((item) => limit(() => fetchArticle(item.url, item.title))))).filter(Boolean);
  },
};
