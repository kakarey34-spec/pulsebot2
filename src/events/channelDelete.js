const { AuditLogEvent } = require('discord.js');
const { logChannel } = require('../utils/logger');
const { trackAction } = require('../services/antiNuke');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;

    let executorId = null;
    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
      }
    } catch {
      /* ignore */
    }

    if (executorId) {
      await trackAction(channel.client, channel.guild, executorId, 'channel_delete', 'maxChannelDeletes');
    }

    await logChannel(channel.client, channel.guild.id, 'Channel Deleted', [
      `**Channel:** #${channel.name} (\`${channel.id}\`)`,
      executorId ? `**By:** <@${executorId}>` : '',
    ]
      .filter(Boolean)
      .join('\n'));
  },
};
