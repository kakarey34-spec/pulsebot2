const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { LEVELS } = require('../utils/permissions');
const { buildPanelComponents, CV2 } = require('../utils/components');
const { countActiveTickets, registerPanelMessage } = require('../services/ticketCounters');
const store = require('../config/store');
const ticketManager = require('../services/ticketManager');
const { buildMessageContainer } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage Pulse Studios tickets')
    .addSubcommand((sub) =>
      sub.setName('panel').setDescription('Post the multi-option ticket panel in this channel')
    )
    .addSubcommand((sub) =>
      sub
        .setName('find')
        .setDescription('Find a user\'s open ticket (mod+)')
        .addUserOption((opt) => opt.setName('user').setDescription('User to look up').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('note')
        .setDescription('Add a staff note to the current ticket (mod+)')
        .addStringOption((opt) =>
          opt.setName('text').setDescription('Internal note').setRequired(true).setMaxLength(500)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List open tickets (mod+)'))
    .addSubcommand((sub) => sub.setName('stats').setDescription('Ticket queue summary (mod+)'))
    .addSubcommand((sub) => sub.setName('close').setDescription('Close the current ticket (mod+)'))
    .addSubcommand((sub) =>
      sub
        .setName('approve')
        .setDescription('Approve payment in a purchase ticket (mod+)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Ticket channel (defaults to current)')
            .addChannelTypes(ChannelType.GuildText)
        )
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { canUse, denyInteraction } = require('../utils/permissions');

    if (sub === 'panel') {
      if (!canUse(interaction.member, LEVELS.mod)) {
        return denyInteraction(interaction, 'mod');
      }

      await interaction.deferReply({ ephemeral: true });
      const counters = countActiveTickets(interaction.guild.id);
      const { components, files } = buildPanelComponents(interaction.guild.id, counters);

      const message = await interaction.channel.send({ components, files, flags: CV2 });
      await registerPanelMessage(interaction.guild.id, interaction.channel.id, message.id);

      return interaction.editReply({ content: 'Ticket panel posted with live counters.' });
    }

    if (sub === 'close') {
      if (!canUse(interaction.member, LEVELS.mod)) {
        return denyInteraction(interaction, 'mod');
      }
      const ticket = store.getTicket(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ content: 'Use this inside a ticket channel.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      await ticketManager.closeTicket(interaction.channel, interaction.user);
      return interaction.editReply({ content: 'Ticket will close shortly.' });
    }

    if (sub === 'approve') {
      if (!canUse(interaction.member, LEVELS.mod)) {
        return denyInteraction(interaction, 'mod');
      }
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await interaction.deferReply({ ephemeral: true });
      const result = await ticketManager.approvePayment(
        interaction.guild,
        channel.id,
        interaction.user
      );
      if (result.error) return interaction.editReply({ content: result.error });
      return interaction.editReply({ content: 'Payment approved.' });
    }

    if (sub === 'find') {
      if (!canUse(interaction.member, LEVELS.mod)) {
        return denyInteraction(interaction, 'mod');
      }
      const user = interaction.options.getUser('user', true);
      const ticket = store.findOpenTicketByUser(interaction.guild.id, user.id);
      if (!ticket) {
        return interaction.reply({ content: `${user} has no open ticket.`, ephemeral: true });
      }
      return interaction.reply({
        content: `Open ticket: <#${ticket.channelId}> · \`${ticket.category}\` · stage \`${ticket.stage}\``,
        ephemeral: true,
      });
    }

    if (sub === 'note') {
      if (!canUse(interaction.member, LEVELS.mod)) {
        return denyInteraction(interaction, 'mod');
      }
      const ticket = store.getTicket(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ content: 'Use this inside a ticket channel.', ephemeral: true });
      }
      ticket.staffNote = interaction.options.getString('text', true).trim();
      store.setTicket(interaction.channel.id, ticket);
      return interaction.reply({ content: 'Staff note saved.', ephemeral: true });
    }

    if (sub === 'list' || sub === 'stats') {
      if (!canUse(interaction.member, LEVELS.mod)) {
        return denyInteraction(interaction, 'mod');
      }

      const { tickets, totalOpen, awaitingApproval, oldest } = ticketManager.getTicketStats(
        interaction.guild.id
      );

      if (sub === 'stats') {
        const body = [
          `**Open tickets:** ${totalOpen}`,
          `**Awaiting approval:** ${awaitingApproval}`,
          oldest
            ? `**Oldest open:** <#${oldest.channelId}> — <t:${Math.floor(oldest.createdAt / 1000)}:R>`
            : '**Oldest open:** None',
        ].join('\n');

        return interaction.reply({
          components: [buildMessageContainer(interaction.guild.id, 'Ticket Stats', [body])],
          flags: CV2 | require('discord.js').MessageFlags.Ephemeral,
        });
      }

      if (!tickets.length) {
        return interaction.reply({ content: 'No open tickets.', ephemeral: true });
      }

      const lines = tickets.slice(0, 20).map(
        (t) => `<#${t.channelId}> — \`${t.category}\` / \`${t.stage}\` — <@${t.userId}>`
      );

      return interaction.reply({
        components: [
          buildMessageContainer(interaction.guild.id, `Open Tickets (${tickets.length})`, lines),
        ],
        flags: CV2 | require('discord.js').MessageFlags.Ephemeral,
      });
    }
  },
};
