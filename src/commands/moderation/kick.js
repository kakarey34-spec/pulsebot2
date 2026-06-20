const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissionLevel: LEVELS.mod,
  permissionLabel: 'mod',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ content: 'I cannot kick this member.', ephemeral: true });
    }

    const reason = interaction.options.getString('reason') || `Kicked by ${interaction.user.tag}`;
    await target.kick(reason);
    await logModeration(interaction.client, interaction.guild.id, 'Member Kicked', [
      `**User:** ${target.user} (\`${target.user.tag}\`)`,
      `**Moderator:** ${interaction.user}`,
      `**Reason:** ${reason}`,
    ].join('\n'));

    return interaction.reply({ content: `Kicked **${target.user.tag}**.` });
  },
};
