const CHANNEL_ID = "-1001130139845";
const CHANNEL_USERNAME = "zhytomyr";
const CHANNEL_NAME = "pzhytomyr";

function buildMessageUrl(messageId) {
  if (CHANNEL_USERNAME) {
    return `https://t.me/${CHANNEL_USERNAME.replace(/^@/, "")}/${messageId}`;
  }

  if (CHANNEL_ID) {
    return `https://t.me/c/${CHANNEL_ID.replace(/^-100/, "")}/${messageId}`;
  }

  return "";
}

function getPublishedAt(message) {
  if (!message.date) {
    return new Date().toISOString();
  }

  if (message.date instanceof Date) {
    return message.date.toISOString();
  }

  return new Date(Number(message.date) * 1000).toISOString();
}

export default {
  id: "pzhytomyr",
  channelId: CHANNEL_ID,
  channelUsername: CHANNEL_USERNAME,
  channelName: CHANNEL_NAME,
  enabled: Boolean(CHANNEL_ID || CHANNEL_USERNAME),

  /**
   * Parse one Telegram post from this channel.
   *
   * Fill CHANNEL_ID above with the Telegram channel id when ready.
   */
  parse(message) {
    const body = message.message || "";

    if (!body.trim()) {
      return null;
    }

    return {
      url: buildMessageUrl(message.id),
      body,
      publishedAt: getPublishedAt(message),
    };
  },
};
