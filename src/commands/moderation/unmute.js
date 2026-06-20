const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');
const store = require('../../config/store');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove mute from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to unmute').setRequired(true)),
  permissionLevel: LEVELS.mod,
  permissionLabel: 'mod',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }

    const config = store.getGuild(interaction.guild.id);
    const muteRoleId = config.roles.muteRoleId;

    if (muteRoleId && target.roles.cache.has(muteRoleId)) {
      await target.roles.remove(muteRoleId, `Unmuted by ${interaction.user.tag}`);
    } else if (target.communicationDisabledUntilTimestamp) {
      await target.timeout(null, `Unmuted by ${interaction.user.tag}`);
    } else {
      return interaction.reply({ content: 'That member is not muted.', ephemeral: true });
    }

    await logModeration(interaction.client, interaction.guild.id, 'Member Unmuted', [
      `**User:** ${target.user}`,
      `**Moderator:** ${interaction.user}`,
    ].join('\n'));

    return interaction.reply({ content: `Unmuted **${target.user.tag}**.` });
  },
};
