const path = require('path');
const fs = require('fs');
const store = require('../config/store');

/** Pulse Studios brand palette — electric blue on black. */
const BRAND = {
  blue: 0x00aeef,
  blueBright: 0x007bff,
  silver: 0xc0c0c0,
  black: 0x0a0a0a,
  success: 0x22c55e,
  warning: 0xf59e0b,
  danger: 0xdc2626,
};

const LOGO_PATH = path.join(__dirname, '../../assets/pulse-logo.png');

function getBrandColor(guildId) {
  if (guildId) {
    const config = store.getGuild(guildId);
    if (config.embeds?.color) return config.embeds.color;
  }
  return BRAND.blue;
}

function brandFooter(guildId) {
  const config = store.getGuild(guildId);
  return config.embeds?.footer || 'Pulse Studios';
}

function logoExists() {
  return fs.existsSync(LOGO_PATH);
}

const CHANNEL_PREFIX = {
  purchase: 'purchase',
  support: 'support',
  partner: 'partner',
};

function getChannelPrefix(category) {
  return CHANNEL_PREFIX[category] || 'ticket';
}

function formatChannelName(prefix, username) {
  const slug = String(username || 'user')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 28);
  return `${prefix}-${slug}`.slice(0, 100);
}

module.exports = {
  BRAND,
  LOGO_PATH,
  getBrandColor,
  brandFooter,
  logoExists,
  getChannelPrefix,
  formatChannelName,
};
