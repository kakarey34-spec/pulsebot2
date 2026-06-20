const { SlashCommandBuilder } = require('discord.js');
const { buildMessageContainer, CV2 } = require('../utils/components');
const { MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show Pulse Studios bot commands'),
  async execute(interaction) {
    const lines = [
      '**Tickets** — `/ticket panel` · open Purchase / Support / Partner lanes',
      '**Shop** — `/product add` (sellers post products with images)',
      '**Promos** — `/promo create` (discount codes for purchase tickets)',
      '**Giveaways** — `/giveaway start`',
      '**Reviews** — `/rep` in the rep channel',
      '**Config** — `/config` (owner: channels, PayPal, PaySafe, categories)',
      '',
      '**Moderation** — `/ban` `/kick` `/mute` `/unmute` `/clear`',
      '**Utility** — `/say` (mod+)',
      '',
      '*Pulse Studios · Made By LyxosDime*',
    ];

    return interaction.reply({
      components: [buildMessageContainer(interaction.guild.id, 'Pulse Bot Help', lines)],
      flags: CV2 | MessageFlags.Ephemeral,
    });
  },
};
