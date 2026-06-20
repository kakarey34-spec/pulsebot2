const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MediaGalleryBuilder,
} = require('discord.js');
const { getBrandColor, brandFooter, LOGO_PATH, logoExists } = require('./brand');

const CV2 = MessageFlags.IsComponentsV2;

const TICKET_IDS = {
  openPurchase: 'ticket_open_purchase',
  openSupport: 'ticket_open_support',
  openPartner: 'ticket_open_partner',
  close: 'ticket_close',
  claim: 'ticket_claim',
  paymentDone: 'ticket_payment_done',
  promo: 'ticket_promo',
  approve: 'ticket_approve',
  deny: 'ticket_deny',
};

const PAYMENT_IDS = {
  paypal: 'payment_paypal',
  paysafe: 'payment_paysafe',
};

const TICKET_OPEN_MAP = {
  [TICKET_IDS.openPurchase]: 'purchase',
  [TICKET_IDS.openSupport]: 'support',
  [TICKET_IDS.openPartner]: 'partner',
};

function parseTicketOpenCategory(customId) {
  return TICKET_OPEN_MAP[customId] || null;
}

function textBlock(content) {
  return new TextDisplayBuilder().setContent(content);
}

function pulseContainer(guildId, title, body, extra = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(extra.color ?? getBrandColor(guildId))
    .addTextDisplayComponents(textBlock(`## ${title}\n\n${body}`));

  if (extra.footer) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(textBlock(`*${extra.footer}*`));
  }
  return container;
}

function buildCv2Payload(guildId, components, options = {}) {
  const payload = {
    components,
    flags: CV2,
  };
  if (options.ephemeral) {
    payload.flags |= MessageFlags.Ephemeral;
  }
  if (options.files?.length) {
    payload.files = options.files;
  }
  return payload;
}

function buildPanelComponents(guildId, counters) {
  const { purchase = 0, support = 0, partner = 0 } = counters || {};
  const footer = brandFooter(guildId);

  const container = new ContainerBuilder()
    .setAccentColor(getBrandColor(guildId))
    .addTextDisplayComponents(
      textBlock(
        [
          '## Pulse Studios — Support Panel',
          '',
          'Choose a ticket type below. Staff will assist you as soon as possible.',
          '',
          `🛒 **Purchase Tickets:** \`${purchase}\` active`,
          `💬 **Support Tickets:** \`${support}\` active`,
          `🤝 **Partner Tickets:** \`${partner}\` active`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(textBlock(`*${footer} · Made By LyxosDime*`))
    .addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(TICKET_IDS.openPurchase)
          .setLabel('Purchase')
          .setEmoji('🛒')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(TICKET_IDS.openSupport)
          .setLabel('Support')
          .setEmoji('💬')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(TICKET_IDS.openPartner)
          .setLabel('Partner')
          .setEmoji('🤝')
          .setStyle(ButtonStyle.Secondary)
      )
    );

  const components = [container];

  if (logoExists()) {
    components.unshift(
      new MediaGalleryBuilder().addItems((item) =>
        item.setDescription('Pulse Studios').setURL(`attachment://pulse-logo.png`)
      )
    );
  }

  return { components, files: logoExists() ? [new AttachmentBuilder(LOGO_PATH, { name: 'pulse-logo.png' })] : [] };
}

function paymentMethodRow(enabledMethods) {
  const buttons = enabledMethods.map(([key, method]) =>
    new ButtonBuilder()
      .setCustomId(PAYMENT_IDS[key] || `payment_${key}`)
      .setLabel(method.label || key)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(key === 'paypal' ? '💳' : '🎫')
  );
  return [new ActionRowBuilder().addComponents(buttons)];
}

function ticketActionRows(channelId, options = {}) {
  const rows = [];
  if (options.showPayment) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(TICKET_IDS.paymentDone)
          .setLabel('Payment sent')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${TICKET_IDS.promo}:${channelId}`)
          .setLabel('Redeem Discount')
          .setEmoji('🎟️')
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  const staffButtons = [];
  if (options.claimedBy) {
    staffButtons.push(
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.claim}:${channelId}`)
        .setLabel('Claimed')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  } else {
    staffButtons.push(
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.claim}:${channelId}`)
        .setLabel('Claim')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (options.showApproval) {
    staffButtons.push(
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.approve}:${channelId}`)
        .setLabel('Approve')
        .setEmoji('✔️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.deny}:${channelId}`)
        .setLabel('Decline')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Danger)
    );
  }

  staffButtons.push(
    new ButtonBuilder()
      .setCustomId(TICKET_IDS.close)
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(new ActionRowBuilder().addComponents(staffButtons));
  return rows;
}

function buildMessageContainer(guildId, title, lines, footer) {
  return pulseContainer(guildId, title, lines.join('\n'), { footer: footer || brandFooter(guildId) });
}

module.exports = {
  CV2,
  TICKET_IDS,
  PAYMENT_IDS,
  TICKET_OPEN_MAP,
  parseTicketOpenCategory,
  textBlock,
  pulseContainer,
  buildCv2Payload,
  buildPanelComponents,
  paymentMethodRow,
  ticketActionRows,
  buildMessageContainer,
};
