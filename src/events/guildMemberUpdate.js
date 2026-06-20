const { AuditLogEvent } = require('discord.js');
const { logRole } = require('../utils/logger');
const { trackAction } = require('../services/antiNuke');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

    if (!added.size && !removed.size) return;

    let executorId = null;
    try {
      const logs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 1,
      });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === newMember.id && Date.now() - entry.createdTimestamp < 5000) {
        executorId = entry.executor?.id;
      }
    } catch {
      /* missing audit log permission */
    }

    const lines = [`**Member:** ${newMember.user}`];
    if (added.size) lines.push(`**Roles added:** ${added.map((r) => r.name).join(', ')}`);
    if (removed.size) lines.push(`**Roles removed:** ${removed.map((r) => r.name).join(', ')}`);
    if (executorId) lines.push(`**By:** <@${executorId}>`);

    await logRole(newMember.client, newMember.guild.id, 'Member Roles Updated', lines.join('\n'));
  },
};
