const { MessageFlags } = require('discord.js');
const store = require('../config/store');

const LEVELS = {
  everyone: 0,
  seller: 1,
  mod: 2,
  owner: 3,
};

function memberHasRole(member, roleIds) {
  if (!roleIds?.length) return false;
  return roleIds.some((id) => member.roles.cache.has(id));
}

function getPermissionLevel(member) {
  if (!member) return LEVELS.everyone;
  if (member.guild.ownerId === member.id) return LEVELS.owner;

  const config = store.getGuild(member.guild.id);
  if (memberHasRole(member, [config.roles.ownerRoleId])) return LEVELS.owner;
  if (memberHasRole(member, [config.roles.modRoleId])) return LEVELS.mod;
  if (memberHasRole(member, [config.roles.sellerRoleId])) return LEVELS.seller;
  return LEVELS.everyone;
}

function canUse(member, requiredLevel) {
  return getPermissionLevel(member) >= requiredLevel;
}

function isStaff(member) {
  return canUse(member, LEVELS.mod);
}

function isSeller(member) {
  return canUse(member, LEVELS.seller);
}

function denyInteraction(interaction, levelName = 'authorized staff') {
  const payload = {
    content: `You do not have permission. This requires **${levelName}** access.`,
    flags: MessageFlags.Ephemeral,
  };
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

function denyReply(message, levelName = 'authorized staff') {
  return message.reply({
    content: `You do not have permission. This requires **${levelName}** access.`,
    allowedMentions: { repliedUser: false },
  });
}

module.exports = {
  LEVELS,
  getPermissionLevel,
  canUse,
  isStaff,
  isSeller,
  denyInteraction,
  denyReply,
  memberHasRole,
};
