// Disabled: this account is not a member of the "Житомир 24/7" channel, so Telegram rejects the
// backfill with CHANNEL_INVALID. Re-enable and re-verify CHANNEL_ID once the account joins it.
const CONFIG = {
  enabled: false,
  useAi: true,
  backfillLimit: 1000,
};

const CHANNEL_ID = "-1002961480891";
const CHANNEL_USERNAME = "";
const CHANNEL_NAME = "Житомир 24/7";

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
  id: "zhytomyr-24-7",
  channelId: CHANNEL_ID,
  channelUsername: CHANNEL_USERNAME,
  channelName: CHANNEL_NAME,
  enabled: CONFIG.enabled && Boolean(CHANNEL_ID || CHANNEL_USERNAME),
  settings: CONFIG,

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
