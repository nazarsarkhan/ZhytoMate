export default {
  id: 'example-tg',
  channelUsername: 'example_channel',
  enabled: false,

  /**
   * Parse a GramJS message into a raw item.
   *
   * Return shape:
   * { url, body, publishedAt }
   */
  parse(message) {
    const body = message.message || '';

    if (!body.trim()) {
      return null;
    }

    return {
      url: `https://t.me/${this.channelUsername}/${message.id}`,
      body,
      publishedAt: message.date
        ? new Date(message.date * 1000).toISOString()
        : new Date().toISOString(),
    };
  },
};
