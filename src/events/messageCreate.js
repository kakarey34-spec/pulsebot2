const store = require('../config/store');
const ticketManager = require('../services/ticketManager');
const { checkMessage } = require('../services/antiLink');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const config = store.getGuild(message.guild.id);

    if (config.channels?.suggestionChannelId === message.channel.id) {
      await message.react('✅').catch(() => null);
      await message.react('❌').catch(() => null);
    }

    await checkMessage(message);

    if (store.getTicket(message.channel.id)) {
      store.touchTicketActivity(message.channel.id);
      await ticketManager.handleProofMessage(message);
    }
  },
};
