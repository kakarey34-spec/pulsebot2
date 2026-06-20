const { AuditLogEvent } = require('discord.js');
const { logRole } = require('../utils/logger');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Color changed**`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push(`**Permissions changed**`);
    }
    if (!changes.length) return;

    let executorId = null;
    try {
      const logs = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === newRole.id && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
      }
    } catch {
      /* ignore */
    }

    await logRole(newRole.client, newRole.guild.id, 'Role Updated', [
      `**Role:** ${newRole.name}`,
      ...changes,
      executorId ? `**By:** <@${executorId}>` : '',
    ]
      .filter(Boolean)
      .join('\n'));
  },
};
