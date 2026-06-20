const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');
const store = require('../../config/store');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout / mute a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to mute').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('minutes')
        .setDescription('Duration in minutes (default from config)')
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissionLevel: LEVELS.mod,
  permissionLabel: 'mod',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }

    const config = store.getGuild(interaction.guild.id);
    const minutes =
      interaction.options.getInteger('minutes') || config.moderation.muteDurationMinutes || 10;
    const reason = interaction.options.getString('reason') || `Muted by ${interaction.user.tag}`;

    const muteRoleId = config.roles.muteRoleId;
    if (muteRoleId) {
      const role = interaction.guild.roles.cache.get(muteRoleId);
      if (role && target.manageable) {
        await target.roles.add(role, reason);
      } else {
        return interaction.reply({ content: 'Mute role not configured or cannot be applied.', ephemeral: true });
      }
    } else {
      await target.timeout(minutes * 60 * 1000, reason);
    }

    await logModeration(interaction.client, interaction.guild.id, 'Member Muted', [
      `**User:** ${target.user}`,
      `**Moderator:** ${interaction.user}`,
      `**Duration:** ${minutes} minute(s)`,
      `**Reason:** ${reason}`,
    ].join('\n'));

    return interaction.reply({ content: `Muted **${target.user.tag}** for ${minutes} minute(s).` });
  },
};
