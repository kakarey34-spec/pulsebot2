const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { LEVELS } = require('../utils/permissions');
const promoService = require('../services/promoService');
const store = require('../config/store');
const { CV2 } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promo')
    .setDescription('Manage discount promo codes')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a discount code (mod+)')
        .addStringOption((opt) =>
          opt.setName('code').setDescription('Code users will enter').setRequired(true).setMaxLength(32)
        )
        .addNumberOption((opt) =>
          opt
            .setName('discount')
            .setDescription('Discount percent (1–90)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(90)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max_uses')
            .setDescription('Max uses (optional)')
            .setMinValue(1)
            .setMaxValue(100000)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('valid_days')
            .setDescription('Days until code expires')
            .setMinValue(1)
            .setMaxValue(365)
        )
        .addStringOption((opt) =>
          opt.setName('note').setDescription('Staff note').setMaxLength(200)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to announce in (defaults to promo channel or here)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a promo code (mod+)')
        .addStringOption((opt) =>
          opt.setName('code').setDescription('Code to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List promo codes (mod+)')),
  permissionLevel: LEVELS.mod,
  permissionLabel: 'mod',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const result = promoService.createPromoRecord(interaction.guild.id, {
        code: interaction.options.getString('code'),
        value: interaction.options.getNumber('discount'),
        maxUses: interaction.options.getInteger('max_uses'),
        validDays: interaction.options.getInteger('valid_days'),
        createdBy: interaction.user.id,
        note: interaction.options.getString('note'),
      });

      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      const config = store.getGuild(interaction.guild.id);
      const announceChannel =
        interaction.options.getChannel('channel') ||
        (config.channels.promoChannelId
          ? await interaction.client.channels.fetch(config.channels.promoChannelId).catch(() => null)
          : null) ||
        interaction.channel;

      if (announceChannel?.isTextBased()) {
        await promoService.announcePromo(announceChannel, interaction.guild.id, result.promo);
      }

      return interaction.reply({
        content: `Created promo **${result.promo.code}** — ${promoService.promoLabel(result.promo)}. Announcement sent to ${announceChannel}.`,
        ephemeral: true,
      });
    }

    if (sub === 'delete') {
      const code = interaction.options.getString('code');
      if (!promoService.deletePromo(interaction.guild.id, code)) {
        return interaction.reply({ content: 'Promo code not found.', ephemeral: true });
      }
      return interaction.reply({
        content: `Deleted promo **${promoService.normalizeCode(code)}**.`,
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const promos = promoService.listPromos(interaction.guild.id);
      if (!promos.length) {
        return interaction.reply({ content: 'No promo codes configured.', ephemeral: true });
      }
      const lines = promos.map(
        (p) => `• **${p.code}** — ${promoService.promoLabel(p)}\n  ${promoService.formatPromoLimits(p)}`
      );
      return interaction.reply({
        content: `**Promo codes**\n\n${lines.join('\n\n')}`.slice(0, 2000),
        ephemeral: true,
      });
    }
  },
};
