const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require('discord.js');
const { PAYMENT_IDS, TICKET_IDS, parseTicketOpenCategory, CV2 } = require('../utils/components');
const { canUse, LEVELS } = require('../utils/permissions');
const store = require('../config/store');
const ticketManager = require('../services/ticketManager');
const { isEnterButton, handleEnter } = require('../services/giveawayService');
const { getBrandColor } = require('../utils/brand');

const PAYMENT_KEY_MAP = {
  [PAYMENT_IDS.paypal]: 'paypal',
  [PAYMENT_IDS.paysafe]: 'paysafe',
};

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        if (client.slashHandler) {
          await client.slashHandler.handleSlashCommand(interaction);
        }
        return;
      }

      if (!interaction.guild) return;

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('discount_modal:')) {
          const channelId = interaction.customId.split(':')[1];
          const code = interaction.fields.getTextInputValue('code').trim();
          await interaction.deferReply({ ephemeral: true });
          const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
          if (!channel) {
            return interaction.editReply({ content: 'Ticket channel not found.' });
          }
          const result = await ticketManager.applyPromoCode(channel, interaction.user.id, code);
          if (result.error) return interaction.editReply({ content: result.error });
          return interaction.editReply({
            content: `Discount **${result.promo.code}** applied (${result.promo.value}% off). Select a payment method above.`,
          });
        }

        if (interaction.customId.startsWith('deny_modal:')) {
          if (!canUse(interaction.member, LEVELS.mod)) {
            return interaction.reply({ content: 'Only mods can deny payments.', ephemeral: true });
          }
          const channelId = interaction.customId.split(':')[1];
          const reason = interaction.fields.getTextInputValue('reason').trim();
          await interaction.deferReply({ ephemeral: true });
          const result = await ticketManager.denyPayment(
            interaction.guild,
            channelId,
            interaction.user,
            reason
          );
          if (result.error) return interaction.editReply({ content: result.error });
          return interaction.editReply({ content: 'Payment denied.' });
        }

        if (interaction.customId.startsWith('rep:')) {
          const config = store.getGuild(interaction.guild.id);
          const repChannelId = config.channels?.repChannelId;
          const [, channelId, userId] = interaction.customId.split(':');
          if (
            !repChannelId ||
            channelId !== repChannelId ||
            interaction.channelId !== repChannelId ||
            interaction.user.id !== userId
          ) {
            return interaction.reply({ content: 'This form is no longer valid.', ephemeral: true });
          }

          const starsRaw = interaction.fields.getTextInputValue('stars').trim();
          const stars = Number.parseInt(starsRaw, 10);
          if (!Number.isInteger(stars) || stars < 1 || stars > 5 || String(stars) !== starsRaw) {
            return interaction.reply({
              content: 'Enter a whole number from 1 to 5 for stars.',
              ephemeral: true,
            });
          }

          const rating = interaction.fields.getTextInputValue('rating').trim();
          const starText = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);

          const reviewContainer = new ContainerBuilder()
            .setAccentColor(getBrandColor(interaction.guild.id))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                [
                  `## Service Review`,
                  '',
                  `**${interaction.user.username}** left a rating`,
                  '',
                  starText + ` **(${stars}/5)**`,
                  '',
                  `> ${rating.replace(/\n/g, '\n> ')}`,
                ].join('\n')
              )
            );

          await interaction.channel.send({
            content: `${interaction.user}`,
            components: [reviewContainer],
            flags: CV2,
            allowedMentions: { users: [interaction.user.id] },
          });

          return interaction.reply({
            content: 'Your rating has been posted. Thank you!',
            ephemeral: true,
          });
        }
        return;
      }

      if (!interaction.isButton()) return;
      const customId = interaction.customId;

      if (isEnterButton(customId)) {
        return handleEnter(interaction);
      }

      const ticketCategory = parseTicketOpenCategory(customId);
      if (ticketCategory) {
        await interaction.deferReply({ ephemeral: true });
        const result = await ticketManager.createTicket(
          interaction.guild,
          interaction.member,
          ticketCategory
        );
        if (result.error) return interaction.editReply({ content: result.error });
        return interaction.editReply({ content: `Ticket created: ${result.channel}` });
      }

      if (customId.startsWith('payment_')) {
        const methodKey = PAYMENT_KEY_MAP[customId] || customId.replace('payment_', '');
        const result = await ticketManager.selectPaymentMethod(
          interaction.channel,
          interaction.user.id,
          methodKey
        );
        if (result.error) {
          return interaction.reply({ content: result.error, ephemeral: true });
        }
        return interaction.reply({ content: 'Payment details sent above.', ephemeral: true });
      }

      if (customId.startsWith(`${TICKET_IDS.promo}:`)) {
        const channelId = customId.split(':')[1];
        const ticket = store.getTicket(channelId);
        if (!ticket || ticket.userId !== interaction.user.id) {
          return interaction.reply({ content: 'Only the ticket owner can redeem here.', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`discount_modal:${channelId}`)
          .setTitle('Redeem discount code');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('code')
              .setLabel('Discount code')
              .setPlaceholder('e.g. SAVE20')
              .setStyle(TextInputStyle.Short)
              .setMinLength(3)
              .setMaxLength(32)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }

      if (customId === TICKET_IDS.paymentDone) {
        const result = await ticketManager.markPaymentDone(interaction.channel, interaction.user.id);
        if (result.error) {
          return interaction.reply({ content: result.error, ephemeral: true });
        }
        return interaction.reply({ content: 'Please upload your payment proof.', ephemeral: true });
      }

      if (customId.startsWith(`${TICKET_IDS.claim}:`)) {
        if (!canUse(interaction.member, LEVELS.mod)) {
          return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
        }
        const channelId = customId.split(':')[1];
        await interaction.deferReply({ ephemeral: true });
        const result = await ticketManager.claimTicket(interaction.guild, channelId, interaction.member);
        if (result.error) return interaction.editReply({ content: result.error });
        return interaction.editReply({ content: 'Ticket claimed.' });
      }

      if (customId.startsWith(`${TICKET_IDS.approve}:`)) {
        if (!canUse(interaction.member, LEVELS.mod)) {
          return interaction.reply({ content: 'Only mods can approve.', ephemeral: true });
        }
        const channelId = customId.split(':')[1];
        await interaction.deferReply({ ephemeral: true });
        const result = await ticketManager.approvePayment(interaction.guild, channelId, interaction.member);
        if (result.error) return interaction.editReply({ content: result.error });
        return interaction.editReply({ content: 'Payment approved.' });
      }

      if (customId.startsWith(`${TICKET_IDS.deny}:`)) {
        if (!canUse(interaction.member, LEVELS.mod)) {
          return interaction.reply({ content: 'Only mods can deny.', ephemeral: true });
        }
        const channelId = customId.split(':')[1];
        const modal = new ModalBuilder().setCustomId(`deny_modal:${channelId}`).setTitle('Decline payment');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Reason')
              .setStyle(TextInputStyle.Paragraph)
              .setMinLength(3)
              .setMaxLength(500)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }

      if (customId === TICKET_IDS.close) {
        if (!canUse(interaction.member, LEVELS.mod)) {
          return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        await ticketManager.closeTicket(interaction.channel, interaction.user);
        return interaction.editReply({ content: 'Ticket closing...' });
      }
    } catch (err) {
      console.error('Interaction error:', err);
      const payload = { content: 'Something went wrong.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  },
};
