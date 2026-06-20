const { logMember } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    await logMember(member.client, member.guild.id, 'Member Joined', [
      `**User:** ${member.user} (\`${member.user.tag}\`)`,
      `**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      `**Member count:** ${member.guild.memberCount}`,
    ].join('\n'));
  },
};
