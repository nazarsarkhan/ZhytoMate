const defaultTimeoutMs = 20000;
const defaultRetries = 2;
const defaultUserAgent = 'FutureInAction2026Scraper/0.1 (+https://zt-rada.gov.ua/)';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getTimeoutMs(options) {
  const value = Number(options.timeoutMs);
  return Number.isFinite(value) && value > 0 ? value : defaultTimeoutMs;
}

function getRetries(options) {
  const value = Number(options.retries);
  return Number.isInteger(value) && value >= 0 ? value : defaultRetries;
}

function buildHeaders(options) {
  return {
    'user-agent': options.userAgent || defaultUserAgent,
    accept: options.accept || '*/*',
    ...options.headers,
  };
}

export async function fetchWithRetry(url, options = {}) {
  const retries = getRetries(options);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), getTimeoutMs(options));

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: buildHeaders(options),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt >= retries) {
        break;
      }

      await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError.message}`);
}

export async function fetchText(url, options = {}) {
  const response = await fetchWithRetry(url, {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...options,
  });

  return {
    url: response.url,
    contentType: response.headers.get('content-type') || '',
    text: await response.text(),
  };
}

export async function fetchBuffer(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  const arrayBuffer = await response.arrayBuffer();

  return {
    url: response.url,
    contentType: response.headers.get('content-type') || '',
    buffer: Buffer.from(arrayBuffer),
  };
}
