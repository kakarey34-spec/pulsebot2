const { AuditLogEvent } = require('discord.js');
const { logRole } = require('../utils/logger');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    let executorId = null;
    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
      }
    } catch {
      /* ignore */
    }

    await logRole(role.client, role.guild.id, 'Role Created', [
      `**Role:** ${role.name} (\`${role.id}\`)`,
      executorId ? `**By:** <@${executorId}>` : '',
    ]
      .filter(Boolean)
      .join('\n'));
  },
};
