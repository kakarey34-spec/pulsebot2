const { AuditLogEvent } = require('discord.js');
const { logRole } = require('../utils/logger');
const { trackAction } = require('../services/antiNuke');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    let executorId = null;
    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
      }
    } catch {
      /* ignore */
    }

    if (executorId) {
      await trackAction(role.client, role.guild, executorId, 'role_delete', 'maxRoleDeletes');
    }

    await logRole(role.client, role.guild.id, 'Role Deleted', [
      `**Role:** ${role.name} (\`${role.id}\`)`,
      executorId ? `**By:** <@${executorId}>` : '',
    ]
      .filter(Boolean)
      .join('\n'));
  },
};
