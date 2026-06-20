const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { LEVELS } = require('../utils/permissions');
const store = require('../config/store');

const CHANNEL_KEYS = {
  rep: 'repChannelId',
  suggestion: 'suggestionChannelId',
  promo: 'promoChannelId',
  shop: 'shopChannelId',
  member_logs: 'memberLogsId',
  channel_logs: 'channelLogsId',
  role_logs: 'roleLogsId',
  voice_logs: 'voiceLogsId',
  moderation_logs: 'moderationLogsId',
  ticket_transcript: 'ticketTranscriptId',
  antilink_logs: 'antilinkLogsId',
  command_logs: 'commandLogsId',
  security_logs: 'securityLogsId',
  server_logs: 'serverLogsId',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Pulse Studios bot settings (owner)')
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set a log or feature channel')
        .addStringOption((opt) =>
          opt
            .setName('key')
            .setDescription('Which channel to set')
            .setRequired(true)
            .addChoices(
              ...Object.entries(CHANNEL_KEYS).map(([name, value]) => ({ name, value }))
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ticket-category')
        .setDescription('Set ticket category for a ticket type')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Ticket type')
            .setRequired(true)
            .addChoices(
              { name: 'Purchase', value: 'purchase' },
              { name: 'Support', value: 'support' },
              { name: 'Partner', value: 'partner' }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName('category')
            .setDescription('Category where tickets are created')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('paypal')
        .setDescription('Configure PayPal payment instructions')
        .addStringOption((opt) =>
          opt.setName('email').setDescription('PayPal email address').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('instructions')
            .setDescription('Custom instructions shown to buyers')
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('paysafe')
        .setDescription('Configure PaySafe payment instructions')
        .addStringOption((opt) =>
          opt
            .setName('instructions')
            .setDescription('Instructions shown to buyers')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('mute-role')
        .setDescription('Set the mute role for /mute')
        .addRoleOption((opt) => opt.setName('role').setDescription('Mute role').setRequired(true))
    ),
  permissionLevel: LEVELS.owner,
  permissionLabel: 'owner',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const key = interaction.options.getString('key');
      const channel = interaction.options.getChannel('channel');
      const pathKey = CHANNEL_KEYS[key];
      store.setPath(interaction.guild.id, `channels.${pathKey}`, channel.id);
      return interaction.reply({
        content: `Set **${key}** channel to ${channel}.`,
        ephemeral: true,
      });
    }

    if (sub === 'ticket-category') {
      const type = interaction.options.getString('type');
      const category = interaction.options.getChannel('category');
      store.setPath(interaction.guild.id, `tickets.${type}CategoryId`, category.id);
      return interaction.reply({
        content: `**${type}** tickets will be created under **${category.name}**.`,
        ephemeral: true,
      });
    }

    if (sub === 'paypal') {
      const email = interaction.options.getString('email');
      const instructions = interaction.options.getString('instructions');
      store.setPath(interaction.guild.id, 'payments.paypal.email', email);
      if (instructions) {
        store.setPath(interaction.guild.id, 'payments.paypal.instructions', instructions);
      }
      return interaction.reply({ content: 'PayPal settings updated.', ephemeral: true });
    }

    if (sub === 'paysafe') {
      const instructions = interaction.options.getString('instructions');
      store.setPath(interaction.guild.id, 'payments.paysafe.instructions', instructions);
      return interaction.reply({ content: 'PaySafe settings updated.', ephemeral: true });
    }

    if (sub === 'mute-role') {
      const role = interaction.options.getRole('role');
      store.setPath(interaction.guild.id, 'roles.muteRoleId', role.id);
      return interaction.reply({ content: `Mute role set to ${role}.`, ephemeral: true });
    }
  },
};
