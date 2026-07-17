import { load } from "cheerio";
import pLimit from "p-limit";
import { fetchBuffer, fetchText } from "../../core/web/http-client.js";
import { extractTextFromBuffer } from "../../core/extract/text-extractor.js";

const CONFIG = {
  enabled: true,
  schedule: "*/30 * * * *",
  useAi: false,
  backfillDays: 1095,
  maxPages: 0,
  maxItems: 0,
  attachmentLimitPerPage: 0,
  documentAttachmentLimitPerPage: 0,
  concurrency: 8,
  attachmentConcurrency: 4,
  searchSeedPages: 3,
};
const baseUrl = "https://zt-rada.gov.ua/";
const host = "zt-rada.gov.ua";
export const NEWS_SECTION_PATH = "/press-center/news";
const documentExtensions = new Set(["pdf", "doc", "docx", "txt"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const contentSelectors = [
  "article",
  "main",
  ".content",
  ".doc_page",
  ".page",
  "[class*=content]",
  "[class*=article]",
  "[class*=news]",
];
const noisySelectors = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "form",
  "button",
  "header",
  "footer",
  "nav",
  ".header",
  ".footer",
  ".social-links",
  ".breadcrumbs",
  ".breadcrumb",
  ".menu",
  ".sidebar",
  ".pagination",
];
const safeHtmlTags = new Set([
  "p",
  "br",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "blockquote",
  "figure",
  "figcaption",
  "img",
]);
// Curated entry points for evergreen council documents and resident-facing reference pages.
// News has its own seed and Telegram items are handled by the Telegram plugins.
export const IMPORTANT_PAGE_SEEDS = [
  "/documents",
  "/perelikdiychuhprogram",
  "/Strategic_sectoral",
  "/MonitoringOfAir",
  "/mistobuddoc",
  "/?items=42",
  "/?items=67",
  "/?items=73",
  "/",
  "/contacts",
  "/?pages=18902",
  "/?departments=1",
  "/?departments=2",
  "/?departments=159",
  "/?departments=20",
  "/?pages=379",
  "/?pages=198",
  "/?pages=1298",
  "/?pages=808",
  "/servisy",
  "/zvernennya",
  "/depytatu",
  "/graficcomisiy",
  "/deptreestr",
  "/dpsp",
  "/usvv",
  "/dmzvzt",
  "/der",
  "/dbfzt",
  "/deposvit",
  "/?departments=9",
  "/?departments=10",
  "/?departments=12",
  "/?departments=13",
  "/?departments=14",
  "/?departments=15",
  "/?departments=24",
  "/?pages=7814",
  "/reglament",
  "/dostypdopubl",
  "/admintasocposlygu",
  "/waterzt",
  "/miscevybudjet",
  "/AirQualityMonitoring",
  "/OfficeofDecarbonization",
  "/policofgromadu",
  "/veteranskaliniya",
  "/transportzt",
  "/opendata",
  "/?items=20",
  "/?items=21",
  "/?items=23",
  "/?items=17",
  "/?items=19",
  "/?items=24",
  "/?items=25",
  "/?items=27",
  "/?items=28",
  "/?items=29",
  "/?items=32",
  "/?items=33",
  "/?items=359",
  "/?items=361",
  "/?pages=10934",
  "/?items=36",
  "/?items=78",
  "/?items=82",
  "/?items=85",
];
const searchSeedTerms = [
  "ВПО",
  "внутрішньо переміщені особи",
  "переселенці",
  "ветеран",
  "ветерани",
  "військовий облік",
  "соціальний захист",
  "соціальні послуги",
  "допомога",
  "житло",
  "безоплатна правнича допомога",
];

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getLimitEnv(name, fallback) {
  const value = Number(process.env[name]);

  if (value === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback === 0 ? Number.POSITIVE_INFINITY : fallback;
}

function getBackfillCutoff() {
  const fromDate = process.env.ZT_RADA_BACKFILL_FROM;

  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    const parsedFromDate = new Date(`${fromDate}T00:00:00.000Z`);

    if (!Number.isNaN(parsedFromDate.getTime())) {
      return parsedFromDate;
    }
  }

  const backfillDays = getNumberEnv("ZT_RADA_BACKFILL_DAYS", CONFIG.backfillDays);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - backfillDays);
  return cutoff;
}

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function buildDocumentSearchUrl(cutoff) {
  const url = new URL("/documents", baseUrl);
  url.searchParams.set("documentDateStart[0]", String(toUnixSeconds(cutoff)));
  url.searchParams.set("documentDateEnd[0]", String(toUnixSeconds(new Date())));
  return url.toString();
}

function buildSearchSeedUrls(term, pages = CONFIG.searchSeedPages) {
  return Array.from({ length: pages }, (_, index) => {
    const url = new URL("/search", baseUrl);
    url.searchParams.set("search", term);

    if (index > 0) {
      url.searchParams.set("page-search", String(index));
    }

    return url.toString();
  });
}

function normalizeWhitespace(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toAbsoluteUrl(value, currentUrl = baseUrl) {
  if (
    !value ||
    value.startsWith("tel:") ||
    value.startsWith("mailto:") ||
    value.startsWith("#")
  ) {
    return null;
  }

  try {
    const url = new URL(value, currentUrl);

    if (url.hostname !== host) {
      return null;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function toAbsoluteAssetUrl(value, currentUrl = baseUrl) {
  if (
    !value ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("#")
  ) {
    return null;
  }

  try {
    const url = new URL(value, currentUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function getExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function isDocumentUrl(url) {
  return documentExtensions.has(getExtension(url));
}

function isImageUrl(url) {
  return imageExtensions.has(getExtension(url));
}

function shouldCrawlPage(url) {
  if (!url) {
    return false;
  }

  if (isDocumentUrl(url)) {
    return false;
  }

  const parsed = new URL(url);
  const path = parsed.pathname;

  if (
    path.startsWith("/files/") ||
    path.startsWith("/uploads/") ||
    path.startsWith("/assets/")
  ) {
    return false;
  }

  return true;
}

function normalizePathname(url) {
  const pathname = new URL(url).pathname.replace(/\/+$/, "");
  return pathname || "/";
}

export function isNewsSectionUrl(url) {
  return normalizePathname(url) === NEWS_SECTION_PATH;
}

export function isNewsArticleUrl(url, knownNewsUrls = new Set()) {
  if (!url) {
    return false;
  }

  const normalizedUrl = new URL(url).toString();
  const pathname = normalizePathname(url);

  return (
    knownNewsUrls.has(normalizedUrl) ||
    pathname.startsWith(`${NEWS_SECTION_PATH}/`)
  );
}

function isDocumentsIndexUrl(url) {
  return Boolean(url) && normalizePathname(url) === "/documents";
}

function inferSourceKind(url, knownNewsUrls = new Set()) {
  const parsed = new URL(url);
  const pathname = normalizePathname(url);

  if (isNewsSectionUrl(url)) {
    return "news-index";
  }

  if (isNewsArticleUrl(url, knownNewsUrls)) {
    return "news";
  }

  if (pathname === "/documents") {
    return "document-index";
  }

  if (parsed.pathname === "/search" || parsed.searchParams.has("search")) {
    return "search";
  }

  if (
    parsed.searchParams.has("pages") ||
    /news|announ|anons/i.test(parsed.pathname)
  ) {
    return "post";
  }

  if (parsed.searchParams.has("items")) {
    return "section";
  }

  if (parsed.pathname.toLowerCase().includes("document")) {
    return "document";
  }

  return "page";
}

function looksLikeAnnouncement(title, text) {
  return /анонс|оголош|новин|запрошу|відбудеться|відключенн|тимчасов/i.test(
    `${title}\n${text}`,
  );
}

function looksLikeReferencePage(title, text) {
  return /програм|план|стратег|документац|моніторинг|перелік|рішенн|розпорядженн|регулятор/i.test(
    `${title}\n${text}`,
  );
}

function inferDocType(sourceKind) {
  if (sourceKind === "news") {
    return "news";
  }

  return "document";
}

function parseNumericDate(value) {
  const match = normalizeWhitespace(value).match(
    /\b([0-3]?\d)[./-]([01]?\d)[./-]((?:19|20)\d{2})\b/,
  );

  if (!match) {
    return null;
  }

  const date = new Date(
    Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

// Search pages only list headlines. Rather than ingest title-only items (which carry no answerable
// body and, as dated news, get born-expired and dropped by the RAG anyway), hand the article URLs
// back to the crawler so each is fetched as a full page with real extracted body text. This is
// what gives the KB substantive content for topics that otherwise appear only as search results.
function parseSearchResultUrls($, currentUrl) {
  const urls = new Set();

  $(".srchpgitm").each((_, element) => {
    const link = $(element).find("a[href]").first();
    const url = toAbsoluteUrl(link.attr("href"), currentUrl);

    if (url && shouldCrawlPage(url)) {
      urls.add(url);
    }
  });

  return [...urls];
}

function parseNewsResultUrls($, currentUrl) {
  const urls = new Set();
  const selectors = [
    ".news-list a[href]",
    ".news-item a[href]",
    ".news-listing a[href]",
    ".press-center a[href]",
    "article a[href]",
    "main [class*=news] a[href]",
    ".content [class*=news] a[href]",
  ];
  const candidates = $(selectors.join(",")).length
    ? $(selectors.join(","))
    : $("main a[href], .content a[href]");

  candidates.each((_, element) => {
    const url = toAbsoluteUrl($(element).attr("href"), currentUrl);

    if (url && shouldCrawlPage(url) && !isNewsSectionUrl(url)) {
      urls.add(url);
    }
  });

  return [...urls];
}

function inferPublishedAt($, fallbackDate) {
  const candidates = [
    $("time[datetime]").first().attr("datetime"),
    $("time").first().text(),
    $("[class*=date], [class*=Date]").first().text(),
    $("body").text().slice(0, 2000),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);

    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }

    const numericDate = parseNumericDate(candidate);

    if (numericDate) {
      return numericDate.toISOString();
    }
  }

  return fallbackDate.toISOString();
}

function buildTitle($, url) {
  const title = normalizeWhitespace(
    $("h1").first().text() ||
      $(".page-title").first().text() ||
      $("title").first().text(),
  );

  if (title) {
    return title.slice(0, 180);
  }

  return new URL(url).pathname.replace(/^\/+/, "") || "zt-rada.gov.ua";
}

function getImageSource($, element, currentUrl) {
  const node = $(element);
  const directSource =
    node.attr("src") ||
    node.attr("data-src") ||
    node.attr("data-original") ||
    node.attr("data-lazy-src");
  const srcset = node.attr("srcset") || node.attr("data-srcset");
  const srcsetSource = srcset?.split(",").at(0)?.trim()?.split(/\s+/).at(0);

  return toAbsoluteAssetUrl(directSource || srcsetSource, currentUrl);
}

function removeAllAttributes(node) {
  for (const name of Object.keys(node.attr() || {})) {
    node.removeAttr(name);
  }
}

function scoreContentElement($, element) {
  const candidate = $(element).clone();
  candidate.find(noisySelectors.join(",")).remove();

  const text = normalizeWhitespace(candidate.text());

  if (text.length < 40) {
    return 0;
  }

  const linkTextLength = normalizeWhitespace(candidate.find("a").text()).length;
  const linkDensity = linkTextLength / Math.max(text.length, 1);
  const paragraphScore = candidate.find("p, li").length * 80;
  const headingScore = candidate.find("h1, h2, h3, h4").length * 50;
  const imageScore = candidate.find("img").length * 30;
  const className = String($(element).attr("class") || "").toLowerCase();
  const noisePenalty = /menu|nav|sidebar|breadcrumb|footer|header|pagination/.test(
    className,
  )
    ? 1000
    : 0;

  return text.length + paragraphScore + headingScore + imageScore - linkDensity * 300 - noisePenalty;
}

function selectMainContent($) {
  let bestElement = null;
  let bestScore = 0;

  $(contentSelectors.join(",")).each((_, element) => {
    const score = scoreContentElement($, element);

    if (score > bestScore) {
      bestElement = element;
      bestScore = score;
    }
  });

  return bestElement ? $(bestElement) : $("body");
}

function getMainContentHtml($) {
  const main = selectMainContent($).clone();
  main.find(noisySelectors.join(",")).remove();
  return $.html(main);
}

function sanitizeContentHtml(html, currentUrl) {
  const $ = load(html || "", null, false);

  $(noisySelectors.join(",")).remove();

  $("*").each((_, element) => {
    const node = $(element);
    const tagName = element.tagName?.toLowerCase();

    if (!safeHtmlTags.has(tagName)) {
      node.replaceWith(node.contents());
      return;
    }

    if (tagName === "a") {
      const href = toAbsoluteUrl(node.attr("href"), currentUrl);
      const text = normalizeWhitespace(node.text());
      removeAllAttributes(node);

      if (!href || !text) {
        node.replaceWith(node.contents());
        return;
      }

      node.attr("href", href);
      return;
    }

    if (tagName === "img") {
      const src = getImageSource($, element, currentUrl);
      const alt = normalizeWhitespace(node.attr("alt"));
      removeAllAttributes(node);

      if (!src || !isImageUrl(src)) {
        node.remove();
        return;
      }

      node.attr("src", src);

      if (alt) {
        node.attr("alt", alt);
      }

      return;
    }

    removeAllAttributes(node);
  });

  $("p,h2,h3,h4,li,figcaption,blockquote").each((_, element) => {
    const node = $(element);

    if (!normalizeWhitespace(node.text()) && node.find("img").length === 0) {
      node.remove();
    }
  });

  return normalizeWhitespace($.root().html());
}

function extractImagesFromHtml(html) {
  const $ = load(html || "", null, false);
  const seen = new Set();
  const images = [];

  $("img[src]").each((_, element) => {
    const node = $(element);
    const url = node.attr("src");

    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);
    images.push({
      url,
      alt: normalizeWhitespace(node.attr("alt")),
      caption: normalizeWhitespace(node.closest("figure").find("figcaption").first().text()),
    });
  });

  return images;
}

function extractTextFromHtml(html) {
  const $ = load(html || "", null, false);

  $("br").replaceWith("\n");
  $("p,h2,h3,h4,li,blockquote,figcaption").each((_, element) => {
    $(element).append("\n");
  });

  return normalizeWhitespace($.root().text().replace(/ *\n */g, "\n"));
}

function extractMetaImage($, currentUrl) {
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const url = toAbsoluteAssetUrl(candidate, currentUrl);

    if (url && isImageUrl(url)) {
      return url;
    }
  }

  return null;
}

export function extractWebContent(html, currentUrl = baseUrl) {
  const $ = load(html);
  const bodyHtml = sanitizeContentHtml(getMainContentHtml($), currentUrl);
  const images = extractImagesFromHtml(bodyHtml);
  const body = extractTextFromHtml(bodyHtml);
  const coverImageUrl = extractMetaImage($, currentUrl) || images[0]?.url || null;

  return {
    body,
    bodyHtml: bodyHtml || null,
    coverImageUrl,
    images,
  };
}

function extractLinks($, currentUrl) {
  const pageLinks = new Set();
  const documentLinks = new Map();
  const main = selectMainContent($).clone();

  main.find(noisySelectors.join(",")).remove();

  main.find("a[href]").each((_, element) => {
    const url = toAbsoluteUrl($(element).attr("href"), currentUrl);

    if (!url) {
      return;
    }

    if (isDocumentUrl(url)) {
      documentLinks.set(url, normalizeWhitespace($(element).text()));
    } else if (shouldCrawlPage(url)) {
      pageLinks.add(url);
    }
  });

  return {
    pageLinks: [...pageLinks],
    documentLinks: [...documentLinks].map(([url, title]) => ({ url, title })),
  };
}

async function extractAttachment(attachment) {
  const url = typeof attachment === "string" ? attachment : attachment.url;

  try {
    const downloaded = await fetchBuffer(url);
    const extracted = await extractTextFromBuffer({
      url: downloaded.url,
      contentType: downloaded.contentType,
      buffer: downloaded.buffer,
    });

    return {
      url,
      title: typeof attachment === "string" ? "" : attachment.title,
      ok: extracted.ok,
      kind: extracted.kind,
      text: extracted.text,
      error: extracted.error,
    };
  } catch (error) {
    return {
      url,
      title: typeof attachment === "string" ? "" : attachment.title,
      ok: false,
      kind: null,
      text: "",
      error: error.message,
    };
  }
}

function combineBody(pageText, attachments) {
  const parts = [pageText];

  for (const attachment of attachments) {
    const header = `Attachment: ${attachment.title || attachment.url}`;

    if (attachment.ok) {
      parts.push(`${header}\n${attachment.text}`);
    } else {
      parts.push(`${header}\ntext_extraction_failed: ${attachment.error}`);
    }
  }

  return normalizeWhitespace(parts.filter(Boolean).join("\n\n"));
}

function logParsedItem(item, count = null) {
  if (count !== null && count !== 1 && count % 50 !== 0) {
    return;
  }

  console.log(
    [
      `zt-rada parsed item${count === null ? "" : ` #${count}`}:`,
      item.docType || "unknown",
      item.sourceKind || "unknown",
      item.title || item.url,
    ].join(" "),
  );
}

export function shouldKeepItem(item, cutoff) {
  if (!item.body || item.body.length < 40) {
    return false;
  }

  if (item.sourceKind === "page" || item.sourceKind === "section") {
    return true;
  }

  return new Date(item.publishedAt) >= cutoff;
}

function buildAttachmentItem(pageUrl, attachment, publishedAt) {
  const title =
    normalizeWhitespace(attachment.title) ||
    attachment.url.split("/").pop() ||
    attachment.url;
  const body = attachment.ok
    ? attachment.text
    : `text_extraction_failed: ${attachment.error}`;

  return {
    url: attachment.url,
    title,
    body,
    publishedAt,
    category: "politics",
    docType: "document",
    sourceKind: "document",
    attachments: [
      {
        url: attachment.url,
        kind: attachment.kind,
        ok: attachment.ok,
        error: attachment.error,
        pageUrl,
      },
    ],
  };
}

async function parsePage(
  url,
  cutoff,
  attachmentLimit,
  documentAttachmentLimit,
  attachmentLimiter,
  knownNewsUrls,
  documentsOnly,
) {
  const page = await fetchText(url);
  const $ = load(page.text);
  const sourceKind = inferSourceKind(page.url, knownNewsUrls);
  const title = buildTitle($, url);
  const publishedAt = inferPublishedAt($, new Date());
  const content = extractWebContent(page.text, page.url);
  const pageText = content.body;
  const links = extractLinks($, page.url);
  const attachments = [];
  const maxAttachments =
    sourceKind === "document-index" ? documentAttachmentLimit : attachmentLimit;

  if (sourceKind === "search") {
    // Crawl the civic articles surfaced by the search seeds BEFORE generic nav/section pages, so the
    // high-value how-to content is captured within the page budget instead of losing the race to it.
    return {
      items: [],
      pageLinks: parseSearchResultUrls($, page.url),
      priorityPageLinks: true,
    };
  }

  if (sourceKind === "news-index") {
    const newsArticleUrls = parseNewsResultUrls($, page.url);

    return {
      items: [],
      pageLinks: newsArticleUrls,
      priorityPageLinks: true,
      newsArticleUrls,
    };
  }

  attachments.push(
    ...(await Promise.all(
      links.documentLinks
        .slice(0, maxAttachments)
        .map((attachment) => attachmentLimiter(() => extractAttachment(attachment))),
    )),
  );

  if (sourceKind === "document-index" && attachments.length > 0) {
    return {
      items: attachments
        .map((attachment) =>
          buildAttachmentItem(page.url, attachment, publishedAt),
        )
        .filter((item) => shouldKeepItem(item, cutoff)),
      pageLinks: documentsOnly
        ? links.pageLinks.filter(isDocumentsIndexUrl)
        : links.pageLinks,
    };
  }

  const item = {
    url: page.url,
    title,
    body: combineBody(pageText, attachments),
    bodyHtml: content.bodyHtml,
    coverImageUrl: content.coverImageUrl,
    images: content.images,
    publishedAt,
    category:
      sourceKind === "document" || sourceKind === "document-index"
        ? "politics"
        : undefined,
    docType: inferDocType(sourceKind),
    sourceKind,
    ttlDays: sourceKind === "news" ? backfillNewsTtlDays : undefined,
    attachments: attachments.map((attachment) => ({
      url: attachment.url,
      title: attachment.title,
      kind: attachment.kind,
      ok: attachment.ok,
      error: attachment.error,
    })),
  };

  return {
    items: shouldKeepItem(item, cutoff) ? [item] : [],
    pageLinks: documentsOnly
      ? links.pageLinks.filter(isDocumentsIndexUrl)
      : links.pageLinks,
  };
}

async function fetchCalendarItems(cutoff) {
  try {
    const response = await fetchText(
      new URL("/var-calendar/get-events", baseUrl).toString(),
      {
        accept: "application/json,text/plain,*/*",
      },
    );
    const events = JSON.parse(response.text);

    if (!Array.isArray(events)) {
      return [];
    }

    return events
      .map((event) => {
        const publishedAt = event.date
          ? new Date(`${event.date}T00:00:00.000Z`).toISOString()
          : new Date().toISOString();

        return {
          url: `${baseUrl}var-calendar/get-events#${event.date || ""}`,
          title: `Calendar event ${event.date || ""}`.trim(),
          body: normalizeWhitespace(event.event),
          publishedAt,
          category: "safety",
          docType: "document",
          sourceKind: "calendar",
        };
      })
      .filter((item) => item.body && new Date(item.publishedAt) >= cutoff);
  } catch (error) {
    console.error(`zt-rada calendar fetch failed: ${error.message}`);
    return [];
  }
}

export default {
  id: "zt-rada",
  schedule: CONFIG.schedule,
  enabled: CONFIG.enabled,
  settings: CONFIG,

  async fetch({ onItems } = {}) {
    const cutoff = getBackfillCutoff();
    const maxPages = getLimitEnv("ZT_RADA_MAX_PAGES", CONFIG.maxPages);
    const maxItems = getLimitEnv("ZT_RADA_MAX_ITEMS", CONFIG.maxItems);
    const attachmentLimit = getLimitEnv(
      "ZT_RADA_ATTACHMENT_LIMIT_PER_PAGE",
      CONFIG.attachmentLimitPerPage,
    );
    const documentAttachmentLimit = getLimitEnv(
      "ZT_RADA_DOCUMENT_ATTACHMENT_LIMIT_PER_PAGE",
      CONFIG.documentAttachmentLimitPerPage,
    );
    const concurrency = getNumberEnv("ZT_RADA_CONCURRENCY", CONFIG.concurrency);
    const attachmentConcurrency = getNumberEnv(
      "ZT_RADA_ATTACHMENT_CONCURRENCY",
      CONFIG.attachmentConcurrency,
    );
    const backfillNewsTtlDays = getNumberEnv(
      "RAG_BACKFILL_NEWS_TTL_DAYS",
      120,
    );
    const documentsOnly = process.env.ZT_RADA_DOCUMENTS_ONLY === "true";
    const knowledgeOnly = process.env.ZT_RADA_KNOWLEDGE_ONLY === "true";
    const limit = pLimit(concurrency);
    const attachmentLimiter = pLimit(attachmentConcurrency);
    const queued = documentsOnly
      ? [buildDocumentSearchUrl(cutoff)]
      : knowledgeOnly
        ? IMPORTANT_PAGE_SEEDS.map((seed) => new URL(seed, baseUrl).toString())
        : [
            new URL(NEWS_SECTION_PATH, baseUrl).toString(),
            ...searchSeedTerms.flatMap((term) => buildSearchSeedUrls(term)),
            ...IMPORTANT_PAGE_SEEDS.map((seed) => new URL(seed, baseUrl).toString()),
            buildDocumentSearchUrl(cutoff),
          ];
    const seen = new Set();
    const queuedSet = new Set(queued);
    const knownNewsUrls = new Set();
    const items = await fetchCalendarItems(cutoff);
    let emittedItemCount = 0;

    async function emitNewItems() {
      if (typeof onItems !== "function" || items.length <= emittedItemCount) {
        return;
      }

      const newItems = items.slice(emittedItemCount);
      emittedItemCount = items.length;
      await onItems(newItems);
    }

    for (const item of items) {
      logParsedItem(item);
    }

    await emitNewItems();

    async function visit(url) {
      if (seen.has(url) || seen.size >= maxPages || items.length >= maxItems) {
        return;
      }

      seen.add(url);

      try {
        const result = await parsePage(
          url,
          cutoff,
          attachmentLimit,
          documentAttachmentLimit,
          attachmentLimiter,
          knownNewsUrls,
          documentsOnly,
        );

        for (const newsUrl of result.newsArticleUrls || []) {
          knownNewsUrls.add(newsUrl);
        }

        for (const item of result.items) {
          if (items.length < maxItems) {
            items.push(item);
            logParsedItem(item, items.length);
          }
        }

        for (const link of result.pageLinks) {
          if (seen.has(link) || queuedSet.has(link)) {
            continue;
          }

          queuedSet.add(link);

          if (result.priorityPageLinks) {
            queued.unshift(link);
          } else {
            queued.push(link);
          }
        }
      } catch (error) {
        console.error(`zt-rada page fetch failed ${url}: ${error.message}`);
      }
    }

    while (
      queued.length > 0 &&
      seen.size < maxPages &&
      items.length < maxItems
    ) {
      const batch = queued.splice(0, concurrency);
      await Promise.all(batch.map((url) => limit(() => visit(url))));
      await emitNewItems();

      if (seen.size % 50 < concurrency || queued.length === 0) {
        console.log(
          `zt-rada crawl progress: ${seen.size} page(s), ${items.length} item(s), ${queued.length} queued`,
        );
      }
    }

    await emitNewItems();
    return items.slice(0, maxItems);
  },
};
