export default {
  id: 'example-web',
  schedule: '*/30 * * * *',
  enabled: true,

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
