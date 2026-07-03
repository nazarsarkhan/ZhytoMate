const CONFIG = {
  enabled: false,
  schedule: '*/30 * * * *',
  useAi: false,
  maxPages: 10,
  maxItems: 25,
};

export default {
  id: 'example-web',
  schedule: CONFIG.schedule,
  enabled: CONFIG.enabled,
  settings: CONFIG,

  /**
   * Fetch items from a website, RSS feed, or API.
   *
   * Return shape:
   * [{ url, title, body, publishedAt }]
   */
  async fetch() {
    return [
      {
        url: 'https://example.com/news/example',
        title: 'Example web item',
        body: 'Replace this stub with parsed web content.',
        publishedAt: new Date().toISOString(),
      },
    ];
  },
};
