const store = require('../config/store');
const { logSecurity } = require('../utils/logger');
const { isStaff } = require('../utils/permissions');

const actionBuckets = new Map();

function bucketKey(guildId, userId, action) {
  return `${guildId}:${userId}:${action}`;
}

function recordAction(guildId, userId, action, windowSeconds) {
  const key = bucketKey(guildId, userId, action);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  let entries = actionBuckets.get(key) || [];
  entries = entries.filter((t) => now - t < windowMs);
  entries.push(now);
  actionBuckets.set(key, entries);
  return entries.length;
}

function isWhitelisted(member, config) {
  if (!member) return true;
  if (member.guild.ownerId === member.id) return true;
  if (isStaff(member)) return true;
  const allowed = config.antiLink?.allowedRoleIds || [];
  return allowed.some((id) => member.roles.cache.has(id));
}

async function handleThreshold(client, guild, executor, action, count, limit) {
  const config = store.getGuild(guild.id);
  await logSecurity(client, guild.id, 'Anti-Nuke Triggered', [
    `**User:** ${executor} (\`${executor.tag}\`)`,
    `**Action:** ${action}`,
    `**Count:** ${count} (limit: ${limit})`,
    '**Response:** Attempted to strip roles and ban.',
  ].join('\n'));

  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (member && member.bannable) {
    await member.roles.set([], 'Anti-nuke protection').catch(() => null);
    await member.ban({ reason: `Anti-nuke: ${action} threshold exceeded` }).catch(() => null);
  }
}

async function trackAction(client, guild, executorId, action, limitKey) {
  const config = store.getGuild(guild.id);
  if (!config.antiNuke?.enabled) return;

  const executor = await client.users.fetch(executorId).catch(() => null);
  if (!executor) return;

  const member = await guild.members.fetch(executorId).catch(() => null);
  if (isWhitelisted(member, config)) return;

  const windowSeconds = config.antiNuke.windowSeconds || 10;
  const limit = config.antiNuke[limitKey] || 3;
  const count = recordAction(guild.id, executorId, action, windowSeconds);

  if (count >= limit) {
    await handleThreshold(client, guild, executor, action, count, limit);
  }
}

module.exports = {
  trackAction,
  isWhitelisted,
};
