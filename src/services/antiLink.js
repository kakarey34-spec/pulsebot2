const store = require('../config/store');
const { logAntilink } = require('../utils/logger');
const { isWhitelisted } = require('./antiNuke');

const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s<]+|[a-z0-9-]+\.(?:com|net|org|gg|io|me|co|xyz|dev|app|tv|ly|link|shop|store)(?:\/[^\s]*)?/gi;

function containsLink(content) {
  if (!content) return false;
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(content);
}

async function checkMessage(message) {
  if (message.author.bot || !message.guild) return false;

  const config = store.getGuild(message.guild.id);
  if (!config.antiLink?.enabled) return false;
  if (isWhitelisted(message.member, config)) return false;

  if (!containsLink(message.content)) return false;

  await message.delete().catch(() => null);

  await logAntilink(message.client, message.guild.id, 'Link Blocked', [
    `**User:** ${message.author} (\`${message.author.tag}\`)`,
    `**Channel:** ${message.channel}`,
    `**Content:** ${message.content.slice(0, 500)}`,
  ].join('\n'));

  const warning = await message.channel
    .send({
      content: `${message.author}, links are not allowed in this server.`,
    })
    .catch(() => null);

  if (warning) {
    setTimeout(() => warning.delete().catch(() => null), 5000);
  }

  return true;
}

module.exports = { checkMessage, containsLink };
