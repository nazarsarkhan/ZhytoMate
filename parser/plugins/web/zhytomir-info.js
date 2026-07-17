import { load } from 'cheerio';
import pLimit from 'p-limit';
import { fetchText } from '../../core/web/http-client.js';

const BASE_URL = 'https://www.zhitomir.info/';
const NEWS_URL = `${BASE_URL}news.html`;
const CONFIG = {
  enabled: true,
  schedule: '*/30 * * * *',
  backfillDays: 14,
  maxItems: 500,
  maxPages: 50,
  pageSize: 15,
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

function buildNewsPageUrl(page, pageSize = CONFIG.pageSize) {
  const url = new URL(NEWS_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per-page', String(pageSize));
  return url.toString();
}

function getPositiveNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBackfillCutoff() {
  const configuredDays = Number(process.env.ZHYTOMYR_INFO_BACKFILL_DAYS);
  const backfillDays = Number.isFinite(configuredDays) && configuredDays > 0
    ? configuredDays
    : CONFIG.backfillDays;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - backfillDays);
  return cutoff;
}

function collectArticleLinks($, linkMap) {
  $('a[href^="/news_"]').each((_index, element) => {
    const href = $(element).attr('href');
    const title = $(element).text().replace(/\s+/g, ' ').trim();

    if (href && title) {
      linkMap.set(href, { url: new URL(href, BASE_URL).toString(), title });
    }
  });
}

export default {
  id: 'zhytomir-info',
  schedule: CONFIG.schedule,
  enabled: CONFIG.enabled,
  settings: CONFIG,

  async fetch() {
    const cutoff = getBackfillCutoff();
    const maxItems = getPositiveNumber('ZHYTOMYR_INFO_MAX_ITEMS', CONFIG.maxItems);
    const maxPages = getPositiveNumber('ZHYTOMYR_INFO_MAX_PAGES', CONFIG.maxPages);
    const pageSize = getPositiveNumber('ZHYTOMYR_INFO_PAGE_SIZE', CONFIG.pageSize);
    const concurrency = getPositiveNumber('ZHYTOMYR_INFO_CONCURRENCY', CONFIG.concurrency);
    const linkMap = new Map();
    const items = [];
    const limit = pLimit(concurrency);

    for (let page = 1; page <= maxPages && linkMap.size < maxItems; page += 1) {
      const pageUrl = page === 1 ? NEWS_URL : buildNewsPageUrl(page, pageSize);
      const { text } = await fetchText(pageUrl);
      const $ = load(text);
      const previousSize = linkMap.size;

      collectArticleLinks($, linkMap);

      if (linkMap.size === previousSize) {
        break;
      }

      const pageLinks = [...linkMap.values()].slice(previousSize, maxItems);
      const pageItems = (
        await Promise.all(pageLinks.map((item) => limit(() => fetchArticle(item.url, item.title))))
      )
        .filter(Boolean)
        .map((item) => ({
          ...item,
          ttlDays: getPositiveNumber('RAG_BACKFILL_NEWS_TTL_DAYS', 120),
        }));
      items.push(...pageItems.filter((item) => new Date(item.publishedAt) >= cutoff));

      const datedPageItems = pageItems.filter((item) => !Number.isNaN(new Date(item.publishedAt).getTime()));
      if (datedPageItems.length > 0 && datedPageItems.every((item) => new Date(item.publishedAt) < cutoff)) {
        break;
      }
    }

    return items.slice(0, maxItems);
  },
};
