const { AuditLogEvent } = require('discord.js');
const { logChannel } = require('../utils/logger');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;

    const changes = [];
    if (oldChannel.name !== newChannel.name) {
      changes.push(`**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push(`**Topic changed**`);
    }
    if (!changes.length) return;

    let executorId = null;
    try {
      const logs = await newChannel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === newChannel.id && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
      }
    } catch {
      /* ignore */
    }

    await logChannel(newChannel.client, newChannel.guild.id, 'Channel Updated', [
      `**Channel:** ${newChannel}`,
      ...changes,
      executorId ? `**By:** <@${executorId}>` : '',
    ]
      .filter(Boolean)
      .join('\n'));
  },
};
