import { config } from "../../../config/index.js";

const SOURCE_PAGE_IDS = Array.from({ length: 12 }, (_, index) => index + 1);

function buildUrl(pageId) {
  const url = new URL(config.ztoeBaseUrl);
  if (pageId !== undefined && pageId !== null) {
    url.searchParams.set("pidcherga_id", String(pageId));
  }
  return url;
}

export async function fetchZtoePage(pageId, { signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.outageRequestTimeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(buildUrl(pageId), {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Zhytomate/1.0 (power schedule integration)",
      },
    });

    if (!response.ok) {
      throw new Error(`ZTOE returned HTTP ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    // The legacy ZTOE page declares windows-1251. Decoding as UTF-8 produces unreadable Cyrillic
    // and makes address matching silently fail.
    const html = new TextDecoder("windows-1251").decode(bytes);
    return { pageId, html, fetchedAt: new Date() };
  } finally {
    clearTimeout(timeout);
  }
}

export { SOURCE_PAGE_IDS };

