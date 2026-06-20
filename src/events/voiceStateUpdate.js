const { logVoice } = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (!oldChannel && newChannel) {
      await logVoice(newState.client, newState.guild.id, 'Voice Join', [
        `**User:** ${member.user}`,
        `**Channel:** ${newChannel.name}`,
      ].join('\n'));
      return;
    }

    if (oldChannel && !newChannel) {
      await logVoice(oldState.client, oldState.guild.id, 'Voice Leave', [
        `**User:** ${member.user}`,
        `**Channel:** ${oldChannel.name}`,
      ].join('\n'));
      return;
    }

    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      await logVoice(newState.client, newState.guild.id, 'Voice Move', [
        `**User:** ${member.user}`,
        `**From:** ${oldChannel.name}`,
        `**To:** ${newChannel.name}`,
      ].join('\n'));
    }
  },
};
