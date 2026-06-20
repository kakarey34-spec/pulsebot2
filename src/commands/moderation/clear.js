const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Messages to delete (1–100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  permissionLevel: LEVELS.mod,
  permissionLabel: 'mod',
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });

    const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) {
      return interaction.editReply({
        content: 'Could not delete messages (they may be older than 14 days).',
      });
    }

    await logModeration(interaction.client, interaction.guild.id, 'Messages Cleared', [
      `**Channel:** ${interaction.channel}`,
      `**Moderator:** ${interaction.user}`,
      `**Count:** ${deleted.size}`,
    ].join('\n'));

    return interaction.editReply({ content: `Deleted **${deleted.size}** message(s).` });
  },
};
