const { logMember } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await logMember(member.client, member.guild.id, 'Member Left', [
      `**User:** ${member.user} (\`${member.user.tag}\`)`,
      `**Member count:** ${member.guild.memberCount}`,
    ].join('\n'));
  },
};
