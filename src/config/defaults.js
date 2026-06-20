/** Default guild configuration — merged with persisted JSON on load. */
module.exports = {
  roles: {
    ownerRoleId: '1517510292526075925',
    modRoleId: '1517887427300036628',
    sellerRoleId: '1517887595638558830',
    muteRoleId: null,
  },
  channels: {
    repChannelId: '1517500145149935636',
    suggestionChannelId: '1517695780490707014',
    promoChannelId: null,
    shopChannelId: null,
    memberLogsId: '1517512986409959425',
    channelLogsId: '1517513252341289151',
    roleLogsId: '1517513287363854447',
    voiceLogsId: '1517513324919521290',
    moderationLogsId: '1517513378837303406',
    ticketTranscriptId: '1517513514397204520',
    antilinkLogsId: '1517513591006167242',
    commandLogsId: '1517513697889747044',
    securityLogsId: '1517513767129190523',
    serverLogsId: '1517513808900395058',
  },
  tickets: {
    purchaseCategoryId: null,
    supportCategoryId: null,
    partnerCategoryId: null,
    panelChannelId: null,
    panelMessageIds: [],
    openCooldownMinutes: 5,
    welcomeMessages: {
      purchase:
        'Welcome {user}! Describe what you want to purchase or mention a product from the shop. Staff will assist you with payment.',
      support:
        'Welcome {user}! Please describe your issue and staff will help you shortly.',
      partner:
        'Welcome {user}! Tell us about your partnership proposal and staff will review it.',
    },
  },
  payments: {
    paypal: {
      label: 'PayPal',
      enabled: true,
      email: 'your-paypal@email.com',
      instructions:
        'Send the exact amount shown below to our PayPal.\nInclude your Discord username in the payment note.',
    },
    paysafe: {
      label: 'PaySafe',
      enabled: true,
      instructions:
        'Purchase a PaySafe card for the tier amount shown below and send the code in this ticket.',
    },
  },
  antiNuke: {
    enabled: true,
    maxChannelDeletes: 3,
    maxRoleDeletes: 3,
    maxBans: 3,
    windowSeconds: 10,
  },
  antiLink: {
    enabled: true,
    allowedRoleIds: ['1517510292526075925', '1517887427300036628', '1517887595638558830'],
  },
  moderation: {
    muteDurationMinutes: 10,
  },
  promos: {},
  products: {},
  embeds: {
    color: 0x00aeef,
    footer: 'Pulse Studios',
  },
};
