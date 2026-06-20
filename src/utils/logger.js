const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const store = require('../config/store');
const { getBrandColor, brandFooter } = require('./brand');

const CV2 = MessageFlags.IsComponentsV2;

function logContainer(guildId, title, body) {
  return new ContainerBuilder()
    .setAccentColor(getBrandColor(guildId))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n\n${body}`))
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${brandFooter(guildId)} · <t:${Math.floor(Date.now() / 1000)}:F>*`)
    );
}

async function sendLog(client, guildId, channelKey, title, body) {
  const config = store.getGuild(guildId);
  const channelId = config.channels?.[channelKey];
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  await channel
    .send({
      components: [logContainer(guildId, title, body)],
      flags: CV2,
    })
    .catch((err) => console.warn(`Log to ${channelKey} failed:`, err.message));
}

async function logMember(client, guildId, title, body) {
  return sendLog(client, guildId, 'memberLogsId', title, body);
}

async function logChannel(client, guildId, title, body) {
  return sendLog(client, guildId, 'channelLogsId', title, body);
}

async function logRole(client, guildId, title, body) {
  return sendLog(client, guildId, 'roleLogsId', title, body);
}

async function logVoice(client, guildId, title, body) {
  return sendLog(client, guildId, 'voiceLogsId', title, body);
}

async function logModeration(client, guildId, title, body) {
  return sendLog(client, guildId, 'moderationLogsId', title, body);
}

async function logCommand(client, guildId, user, commandName, channelId) {
  const body = [
    `**User:** ${user} (\`${user.tag}\`)`,
    `**Command:** \`/${commandName}\``,
    `**Channel:** <#${channelId}>`,
  ].join('\n');
  return sendLog(client, guildId, 'commandLogsId', 'Command Used', body);
}

async function logSecurity(client, guildId, title, body) {
  return sendLog(client, guildId, 'securityLogsId', title, body);
}

async function logAntilink(client, guildId, title, body) {
  return sendLog(client, guildId, 'antilinkLogsId', title, body);
}

async function logServer(client, guildId, title, body) {
  return sendLog(client, guildId, 'serverLogsId', title, body);
}

async function logTicket(client, guildId, title, body) {
  return sendLog(client, guildId, 'ticketTranscriptId', title, body);
}

module.exports = {
  logContainer,
  sendLog,
  logMember,
  logChannel,
  logRole,
  logVoice,
  logModeration,
  logCommand,
  logSecurity,
  logAntilink,
  logServer,
  logTicket,
};
