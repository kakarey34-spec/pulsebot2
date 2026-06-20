const { ActivityType } = require('discord.js');
const { startGiveawayScheduler } = require('../services/giveawayScheduler');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    if (client.slashHandler) {
      await client.slashHandler.deployCommands();
    }

    startGiveawayScheduler(client);
    client.user.setActivity('Pulse Studio', { type: ActivityType.Watching });
  },
};
