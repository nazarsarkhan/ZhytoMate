import { load } from "cheerio";
import pLimit from "p-limit";
import { fetchBuffer, fetchText } from "../../core/web/http-client.js";
import { extractTextFromBuffer } from "../../core/extract/text-extractor.js";

const CONFIG = {
  enabled: true,
  schedule: "*/30 * * * *",
  useAi: false,
  backfillMonths: 12,
  maxPages: 800,
  maxItems: 1200,
  attachmentLimitPerPage: 5,
  documentAttachmentLimitPerPage: 20,
  concurrency: 3,
  searchSeedPages: 3,
};
const baseUrl = "https://zt-rada.gov.ua/";
const host = "zt-rada.gov.ua";
const documentExtensions = new Set(["pdf", "doc", "docx", "txt"]);
const staticSeeds = [
  "/?items=67",
  "/?items=73",
  "/?items=42",
  "/perelikdiychuhprogram",
  "/Strategic_sectoral",
  "/MonitoringOfAir",
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

function getBackfillCutoff() {
  const months = getNumberEnv("ZT_RADA_BACKFILL_MONTHS", CONFIG.backfillMonths);
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
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

function stripUi($) {
  $(
    "script,style,noscript,svg,header,footer,nav,.header,.footer,.social-links,.breadcrumbs",
  ).remove();
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

function inferSourceKind(url) {
  const parsed = new URL(url);

  if (parsed.pathname === "/documents") {
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

function inferDocType(sourceKind, title, text) {
  if (sourceKind === "calendar") {
    return "news";
  }

  if (
    sourceKind === "post" &&
    looksLikeAnnouncement(title, text) &&
    !looksLikeReferencePage(title, text)
  ) {
    return "news";
  }

  return "instruction";
}

function inferSearchCategory(term, title) {
  const text = `${term} ${title}`.toLowerCase();

  if (/впо|переміщ|переселен|соціаль|допомог|житл|правнич/.test(text)) {
    return "social";
  }

  if (/ветеран|військов/.test(text)) {
    return "safety";
  }

  return "other";
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

function parseSearchItems($, currentUrl, cutoff) {
  const parsed = new URL(currentUrl);
  const term = parsed.searchParams.get("search") || "";

  return $(".srchpgitm")
    .map((_, element) => {
      const link = $(element).find("a[href]").first();
      const url = toAbsoluteUrl(link.attr("href"), currentUrl);
      const title = normalizeWhitespace(
        $(element).find(".title").first().text() || link.text(),
      );
      const date = parseNumericDate($(element).find(".date").first().text());

      if (!url || !title || !date || date < cutoff) {
        return null;
      }

      return {
        url,
        title,
        body: title,
        publishedAt: date.toISOString(),
        category: inferSearchCategory(term, title),
        docType: "news",
        sourceKind: "search-result",
      };
    })
    .get()
    .filter(Boolean);
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

function extractMainText($) {
  stripUi($);

  const main = $("main, article, .content, .page, .doc_page, .container")
    .filter((_, element) => {
      const text = normalizeWhitespace($(element).text());
      return text.length > 200;
    })
    .first();

  const source = main.length > 0 ? main : $("body");
  return normalizeWhitespace(source.text());
}

function extractLinks($, currentUrl) {
  const pageLinks = new Set();
  const documentLinks = new Map();

  $("a[href]").each((_, element) => {
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

function logParsedItem(item) {
  console.log(
    [
      "zt-rada parsed item:",
      item.docType || "unknown",
      item.sourceKind || "unknown",
      item.title || item.url,
    ].join(" "),
  );
}

function shouldKeepItem(item, cutoff) {
  if (!item.body || item.body.length < 40) {
    return false;
  }

  if (item.sourceKind === "page") {
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
    docType: "instruction",
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
) {
  const page = await fetchText(url);
  const $ = load(page.text);
  const sourceKind = inferSourceKind(page.url);
  const title = buildTitle($, url);
  const publishedAt = inferPublishedAt($, new Date());
  const pageText = extractMainText($);
  const links = extractLinks($, page.url);
  const attachments = [];
  const maxAttachments =
    sourceKind === "document-index" ? documentAttachmentLimit : attachmentLimit;

  if (sourceKind === "search") {
    return {
      items: parseSearchItems($, page.url, cutoff),
      pageLinks: [],
    };
  }

  for (const attachment of links.documentLinks.slice(0, maxAttachments)) {
    attachments.push(await extractAttachment(attachment));
  }

  if (sourceKind === "document-index" && attachments.length > 0) {
    return {
      items: attachments
        .map((attachment) =>
          buildAttachmentItem(page.url, attachment, publishedAt),
        )
        .filter((item) => shouldKeepItem(item, cutoff)),
      pageLinks: links.pageLinks,
    };
  }

  const item = {
    url: page.url,
    title,
    body: combineBody(pageText, attachments),
    publishedAt,
    category:
      sourceKind === "document" || sourceKind === "document-index"
        ? "politics"
        : undefined,
    docType: inferDocType(sourceKind, title, pageText),
    sourceKind,
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
    pageLinks: links.pageLinks,
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
          docType: "news",
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

  async fetch() {
    const cutoff = getBackfillCutoff();
    const maxPages = getNumberEnv("ZT_RADA_MAX_PAGES", CONFIG.maxPages);
    const maxItems = getNumberEnv("ZT_RADA_MAX_ITEMS", CONFIG.maxItems);
    const attachmentLimit = getNumberEnv(
      "ZT_RADA_ATTACHMENT_LIMIT_PER_PAGE",
      CONFIG.attachmentLimitPerPage,
    );
    const documentAttachmentLimit = getNumberEnv(
      "ZT_RADA_DOCUMENT_ATTACHMENT_LIMIT_PER_PAGE",
      CONFIG.documentAttachmentLimitPerPage,
    );
    const concurrency = getNumberEnv("ZT_RADA_CONCURRENCY", CONFIG.concurrency);
    const limit = pLimit(concurrency);
    const queued = [
      ...searchSeedTerms.flatMap((term) => buildSearchSeedUrls(term)),
      ...staticSeeds.map((seed) => new URL(seed, baseUrl).toString()),
      buildDocumentSearchUrl(cutoff),
    ];
    const seen = new Set();
    const queuedSet = new Set(queued);
    const items = await fetchCalendarItems(cutoff);

    for (const item of items) {
      logParsedItem(item);
    }

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
        );

        for (const item of result.items) {
          if (items.length < maxItems) {
            items.push(item);
            logParsedItem(item);
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
    }

    return items.slice(0, maxItems);
  },
};
