const {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const store = require('../config/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Leave a service rating (in the rep channel)'),
  async execute(interaction) {
    const config = store.getGuild(interaction.guild.id);
    const repChannelId = config.channels?.repChannelId;
    if (!repChannelId) {
      return interaction.reply({
        content: 'Rep channel is not configured.',
        ephemeral: true,
      });
    }

    if (interaction.channelId !== repChannelId) {
      return interaction.reply({
        content: `You can only use /rep in <#${repChannelId}>.`,
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`rep:${interaction.channelId}:${interaction.user.id}`)
      .setTitle('Rate Pulse Studios');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('stars')
          .setLabel('How many stars? (1-5)')
          .setPlaceholder('Type a number from 1 to 5')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(1)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rating')
          .setLabel('Rate our service with words')
          .setPlaceholder('Tell us what you thought')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(3)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  },
};
