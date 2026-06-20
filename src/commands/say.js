const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as the bot (mod+)')
    .addStringOption((opt) =>
      opt.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(2000)
    )
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Target channel (default: here)')
    ),
  permissionLevel: LEVELS.mod,
  permissionLabel: 'mod',
  async execute(interaction) {
    const text = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    await channel.send({ content: text });
    return interaction.reply({ content: 'Message sent.', ephemeral: true });
  },
};
