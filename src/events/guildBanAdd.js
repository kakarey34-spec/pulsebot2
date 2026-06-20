const { AuditLogEvent } = require('discord.js');
const { logModeration } = require('../utils/logger');
const { trackAction } = require('../services/antiNuke');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    let executorId = null;
    let reason = ban.reason || 'No reason provided';
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === ban.user.id && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
        reason = entry.reason || reason;
      }
    } catch {
      /* ignore */
    }

    if (executorId) {
      await trackAction(ban.client, ban.guild, executorId, 'ban', 'maxBans');
    }

    await logModeration(ban.client, ban.guild.id, 'Member Banned', [
      `**User:** ${ban.user} (\`${ban.user.tag}\`)`,
      executorId ? `**By:** <@${executorId}>` : '',
      `**Reason:** ${reason}`,
    ]
      .filter(Boolean)
      .join('\n'));
  },
};
