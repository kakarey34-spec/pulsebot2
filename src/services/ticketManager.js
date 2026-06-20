const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  AttachmentBuilder,
  MediaGalleryBuilder,
} = require('discord.js');
const store = require('../config/store');
const { getBrandColor, brandFooter, LOGO_PATH, logoExists } = require('../utils/brand');
const { CV2, buildMessageContainer, paymentMethodRow, ticketActionRows } = require('../utils/components');
const { formatPaypalInstructions, formatPaysafeInstructions } = require('../utils/paysafe');
const promoService = require('./promoService');
const { refreshAllPanels } = require('./ticketCounters');
const { logTicket } = require('../utils/logger');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { OverwriteType } = require('discord-api-types/v10');

const STAGES = {
  OPEN: 'open',
  AWAITING_PAYMENT: 'awaiting_payment',
  AWAITING_PROOF: 'awaiting_proof',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  DENIED: 'denied',
  CLOSED: 'closed',
};

const STAFF_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageChannels,
];

const creationLocks = new Set();

function getCategoryId(config, category) {
  const map = {
    purchase: config.tickets.purchaseCategoryId,
    support: config.tickets.supportCategoryId,
    partner: config.tickets.partnerCategoryId,
  };
  return map[category] || null;
}

function staffRoleIds(config) {
  return [config.roles.ownerRoleId, config.roles.modRoleId, config.roles.sellerRoleId].filter(Boolean);
}

function buildPermissionOverwrites(guild, ownerId, config) {
  const botId = guild.members.me?.id ?? guild.client.user.id;
  const overwrites = [
    {
      id: guild.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: ownerId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: botId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  for (const roleId of staffRoleIds(config)) {
    overwrites.push({
      id: roleId,
      type: OverwriteType.Role,
      allow: STAFF_PERMS,
    });
  }
  return overwrites;
}

function enabledPaymentMethods(config) {
  return Object.entries(config.payments || {}).filter(([, m]) => m?.enabled);
}

async function sendTicketWelcome(channel, guildId, ticket) {
  const config = store.getGuild(guildId);
  const template = config.tickets.welcomeMessages[ticket.category] || 'Welcome {user}!';
  const body = template.replace(/\{user\}/g, `<@${ticket.userId}>`);

  const container = buildMessageContainer(guildId, 'Ticket Opened', [body]);
  const components = [container];
  const rows =
    ticket.category === 'purchase'
      ? [...paymentMethodRow(enabledPaymentMethods(config)), ...ticketActionRows(channel.id, {})]
      : ticketActionRows(channel.id, {});

  await channel.send({
    components: [...components, ...rows],
    flags: CV2,
  });
}

async function createTicket(guild, member, category) {
  const config = store.getGuild(guild.id);
  const lockKey = `${guild.id}:${member.id}`;
  if (creationLocks.has(lockKey)) {
    return { error: 'Please wait — your ticket is being created.' };
  }

  const existing = store.findOpenTicketByUser(guild.id, member.id);
  if (existing) {
    return { error: `You already have an open ticket: <#${existing.channelId}>` };
  }

  const cooldown = store.getTicketCooldown(guild.id, member.id);
  if (cooldown && cooldown.until > Date.now()) {
    const mins = Math.ceil((cooldown.until - Date.now()) / 60000);
    return { error: `You are on ticket cooldown for **${mins} more minute(s)**.` };
  }

  const categoryId = getCategoryId(config, category);
  if (!categoryId) {
    return {
      error: `Ticket category for **${category}** is not configured. Ask an owner to run \`/config ticket-category\`.`,
    };
  }

  creationLocks.add(lockKey);
  try {
    if (!guild.members.me) {
      await guild.members.fetchMe();
    }

    const { getChannelPrefix, formatChannelName } = require('../utils/brand');
    const prefix = getChannelPrefix(category);
    const channel = await guild.channels.create({
      name: formatChannelName(prefix, member.user.username),
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: buildPermissionOverwrites(guild, member.id, config),
      reason: `${category} ticket for ${member.user.tag}`,
    });

    const ticket = {
      guildId: guild.id,
      userId: member.id,
      category,
      stage: STAGES.OPEN,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      amountDue: null,
      promoCode: null,
      claimedBy: null,
    };
    store.setTicket(channel.id, ticket);
    await sendTicketWelcome(channel, guild.id, ticket);
    await refreshAllPanels(guild.client, guild.id);

    return { ok: true, channel };
  } finally {
    creationLocks.delete(lockKey);
  }
}

async function selectPaymentMethod(channel, userId, methodKey) {
  const ticket = store.getTicket(channel.id);
  if (!ticket || ticket.userId !== userId) {
    return { error: 'Only the ticket owner can select a payment method.' };
  }
  if (ticket.category !== 'purchase') {
    return { error: 'Payment methods are only for purchase tickets.' };
  }

  const config = store.getGuild(channel.guild.id);
  const method = config.payments?.[methodKey];
  if (!method?.enabled) return { error: 'That payment method is not available.' };

  let promo = null;
  if (ticket.promoCode) {
    const validated = promoService.validatePromo(channel.guild.id, ticket.promoCode);
    if (validated.ok) promo = validated.promo;
  }

  const baseAmount = ticket.amountDue ?? ticket.productPrice ?? null;
  const pricing = promoService.computePricing(baseAmount, promo);
  const amount = pricing.amountDue ?? baseAmount;

  let instructions;
  if (methodKey === 'paypal') {
    instructions = formatPaypalInstructions(method, amount, channel.guild.members.cache.get(userId)?.user?.username);
  } else if (methodKey === 'paysafe') {
    instructions = formatPaysafeInstructions(method.instructions, amount || 5);
    if (amount) ticket.paysafeTier = require('../utils/paysafe').roundToPaysafeTier(amount);
  } else {
    instructions = method.instructions || 'Follow staff instructions.';
  }

  ticket.paymentMethod = methodKey;
  ticket.stage = STAGES.AWAITING_PAYMENT;
  ticket.amountDue = amount;
  store.setTicket(channel.id, ticket);

  const lines = [
    `**Payment method:** ${method.label}`,
    '',
    instructions,
  ];
  if (promo) {
    lines.push('', `🎟️ Promo **${promo.code}** applied — ${promoService.promoLabel(promo)}`);
  }

  const container = buildMessageContainer(channel.guild.id, 'Payment Instructions', lines);
  const rows = [
    ...paymentMethodRow(enabledPaymentMethods(config)),
    ...ticketActionRows(channel.id, { showPayment: true }),
  ];

  await channel.send({ components: [container, ...rows], flags: CV2 });
  return { ok: true };
}

async function applyPromoCode(channel, userId, code) {
  const ticket = store.getTicket(channel.id);
  if (!ticket || ticket.userId !== userId) {
    return { error: 'Only the ticket owner can redeem a discount here.' };
  }
  if (ticket.category !== 'purchase') {
    return { error: 'Discount codes only work in purchase tickets.' };
  }

  const validated = promoService.validatePromo(channel.guild.id, code);
  if (validated.error) return validated;

  promoService.applyPromoToTicket(ticket, validated.promo);
  store.setTicket(channel.id, ticket);

  const pricing = promoService.computePricing(ticket.productPrice || ticket.amountDue, validated.promo);
  if (pricing.hasNumericPrice) {
    ticket.amountDue = pricing.amountDue;
    store.setTicket(channel.id, ticket);
  }

  return { ok: true, promo: validated.promo, pricing };
}

async function markPaymentDone(channel, userId) {
  const ticket = store.getTicket(channel.id);
  if (!ticket || ticket.userId !== userId) {
    return { error: 'Only the ticket owner can confirm payment.' };
  }

  ticket.stage = STAGES.AWAITING_PROOF;
  store.setTicket(channel.id, ticket);

  const container = buildMessageContainer(channel.guild.id, 'Payment Confirmation', [
    'Please upload your **payment proof** in this channel — screenshot, receipt, or transaction ID.',
  ]);
  await channel.send({ components: [container], flags: CV2 });
  return { ok: true };
}

async function handleProofMessage(message) {
  const ticket = store.getTicket(message.channel.id);
  if (!ticket || ticket.stage !== STAGES.AWAITING_PROOF) return;
  if (message.author.id !== ticket.userId) return;
  if (!message.attachments.size && message.content.length < 5) return;

  ticket.stage = STAGES.AWAITING_APPROVAL;
  ticket.proofMessageId = message.id;
  store.setTicket(message.channel.id, ticket);

  const container = buildMessageContainer(message.guild.id, 'Proof Received', [
    'Your proof is under review. Staff will verify and respond shortly.',
  ]);
  const rows = ticketActionRows(message.channel.id, {
    showApproval: true,
    claimedBy: ticket.claimedBy,
  });
  await message.channel.send({ components: [container, ...rows], flags: CV2 });
}

async function claimTicket(guild, channelId, member) {
  const ticket = store.getTicket(channelId);
  if (!ticket) return { error: 'Not a ticket channel.' };
  if (ticket.claimedBy) return { error: `Already claimed by <@${ticket.claimedBy}>.` };

  ticket.claimedBy = member.id;
  store.setTicket(channelId, ticket);

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) {
    await channel.send({
      components: [
        buildMessageContainer(guild.id, 'Ticket Claimed', [`${member} is now handling this ticket.`]),
      ],
      flags: CV2,
    });
  }
  return { ok: true };
}

async function approvePayment(guild, channelId, member) {
  const ticket = store.getTicket(channelId);
  if (!ticket) return { error: 'Not a ticket channel.' };
  if (ticket.category !== 'purchase') return { error: 'Only purchase tickets can be approved.' };

  if (ticket.promoCode) promoService.consumePromo(guild.id, ticket.promoCode);

  ticket.stage = STAGES.APPROVED;
  store.setTicket(channelId, ticket);

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) {
    await channel.send({
      components: [
        buildMessageContainer(guild.id, 'Payment Approved', [
          `Payment verified by ${member}. Thank you for your purchase!`,
        ]),
      ],
      flags: CV2,
    });
  }
  return { ok: true };
}

async function denyPayment(guild, channelId, member, reason) {
  const ticket = store.getTicket(channelId);
  if (!ticket) return { error: 'Not a ticket channel.' };

  ticket.stage = STAGES.DENIED;
  store.setTicket(channelId, ticket);

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) {
    await channel.send({
      components: [
        buildMessageContainer(guild.id, 'Payment Declined', [
          `Declined by ${member}.`,
          reason ? `\n**Reason:** ${reason}` : '',
        ]),
      ],
      flags: CV2,
    });
  }
  return { ok: true };
}

async function generateTranscript(channel, closedBy) {
  const config = store.getGuild(channel.guild.id);
  const transcriptChannelId = config.channels.ticketTranscriptId;
  if (!transcriptChannelId) return;

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return;

  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = sorted.map((m) => {
    const time = new Date(m.createdTimestamp).toISOString();
    const content = m.content || '[attachment/embed]';
    return `[${time}] ${m.author.tag}: ${content}`;
  });

  const ticket = store.getTicket(channel.id);
  const header = [
    `**Ticket:** #${channel.name}`,
    `**Category:** ${ticket?.category || 'unknown'}`,
    `**Owner:** <@${ticket?.userId || 'unknown'}>`,
    `**Closed by:** ${closedBy}`,
  ].join('\n');

  const transcriptChannel = await channel.client.channels.fetch(transcriptChannelId).catch(() => null);
  if (!transcriptChannel?.isTextBased()) return;

  const buffer = Buffer.from(lines.join('\n'), 'utf8');
  const attachment = new AttachmentBuilder(buffer, { name: `${channel.name}-transcript.txt` });

  await transcriptChannel.send({
    components: [
      buildMessageContainer(channel.guild.id, 'Ticket Transcript', [
        header,
        '',
        `_${lines.length} message(s) attached._`,
      ]),
    ],
    files: [attachment],
    flags: CV2,
  });
}

async function closeTicket(channel, closedBy) {
  const ticket = store.getTicket(channel.id);
  if (!ticket) return { error: 'Not a ticket channel.' };

  ticket.stage = STAGES.CLOSED;
  store.setTicket(channel.id, ticket);

  await generateTranscript(channel, closedBy);
  await logTicket(channel.client, channel.guild.id, 'Ticket Closed', [
    `**Channel:** #${channel.name}`,
    `**Category:** ${ticket.category}`,
    `**Owner:** <@${ticket.userId}>`,
    `**Closed by:** ${closedBy}`,
  ].join('\n'));

  const config = store.getGuild(channel.guild.id);
  const cooldownMin = config.tickets.openCooldownMinutes || 0;
  if (cooldownMin > 0 && ticket.category === 'purchase') {
    store.setTicketCooldown(
      channel.guild.id,
      ticket.userId,
      Date.now() + cooldownMin * 60 * 1000,
      'closed'
    );
  }

  store.deleteTicket(channel.id);
  await refreshAllPanels(channel.client, channel.guild.id);

  await channel.send({
    components: [
      buildMessageContainer(channel.guild.id, 'Ticket Closing', ['This channel will be deleted in 5 seconds.']),
    ],
    flags: CV2,
  });

  setTimeout(() => channel.delete('Ticket closed').catch(() => null), 5000);
  return { ok: true };
}

function getTicketStats(guildId) {
  const tickets = store.listTicketsForGuild(guildId).filter((t) => t.stage !== 'closed');
  return {
    tickets,
    totalOpen: tickets.length,
    awaitingApproval: tickets.filter((t) => t.stage === STAGES.AWAITING_APPROVAL).length,
    oldest: tickets.sort((a, b) => a.createdAt - b.createdAt)[0] || null,
  };
}

module.exports = {
  STAGES,
  createTicket,
  selectPaymentMethod,
  applyPromoCode,
  markPaymentDone,
  handleProofMessage,
  claimTicket,
  approvePayment,
  denyPayment,
  closeTicket,
  getTicketStats,
};
