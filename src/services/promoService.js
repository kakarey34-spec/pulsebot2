const store = require('../config/store');
const { PROMO_TYPES } = require('./promoService');
const { getBrandColor, brandFooter } = require('../utils/brand');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const CV2 = MessageFlags.IsComponentsV2;

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

function getPromoMap(guildId) {
  return store.getGuild(guildId).promos || {};
}

function getPromo(guildId, code) {
  const key = normalizeCode(code);
  if (!key) return null;
  return getPromoMap(guildId)[key] || null;
}

function savePromo(guildId, promo) {
  const config = store.getGuild(guildId);
  const promos = { ...(config.promos || {}) };
  promos[promo.code] = promo;
  store.setGuild(guildId, { promos });
  return promo;
}

function deletePromo(guildId, code) {
  const key = normalizeCode(code);
  const promos = { ...getPromoMap(guildId) };
  if (!promos[key]) return false;
  delete promos[key];
  store.setPath(guildId, 'promos', promos);
  return true;
}

function listPromos(guildId) {
  return Object.values(getPromoMap(guildId)).sort((a, b) => b.createdAt - a.createdAt);
}

function validatePromo(guildId, code) {
  const key = normalizeCode(code);
  if (!key) return { error: 'Enter a valid promo code.' };

  const promo = getPromo(guildId, key);
  if (!promo) return { error: 'That promo code does not exist.' };
  if (promo.expiresAt && Date.now() > promo.expiresAt) {
    return { error: 'This promo code has expired.' };
  }
  if (promo.maxUses != null && promo.uses >= promo.maxUses) {
    return { error: 'This promo code has reached its use limit.' };
  }
  return { ok: true, promo };
}

function consumePromo(guildId, code) {
  const key = normalizeCode(code);
  const promo = getPromo(guildId, key);
  if (!promo) return;
  promo.uses = (promo.uses || 0) + 1;
  savePromo(guildId, promo);
}

function promoLabel(promo) {
  if (promo.type === PROMO_TYPES.discount_percent) {
    return `${promo.value}% off`;
  }
  return promo.code;
}

function formatPromoLimits(promo) {
  const uses =
    promo.maxUses != null ? `${promo.uses || 0}/${promo.maxUses} uses` : `${promo.uses || 0}/∞ uses`;
  const valid =
    promo.expiresAt != null
      ? `expires <t:${Math.floor(promo.expiresAt / 1000)}:F>`
      : 'no expiry';
  return [uses, valid].filter(Boolean).join(' · ');
}

function createPromoRecord(guildId, data) {
  const code = normalizeCode(data.code);
  if (!code || code.length < 3) {
    return { error: 'Code must be at least 3 characters (letters/numbers).' };
  }
  if (getPromo(guildId, code)) return { error: 'That promo code already exists.' };

  const value = Number(data.value);
  if (!Number.isFinite(value) || value <= 0) {
    return { error: 'Value must be a positive number.' };
  }
  if (value < 1 || value > 90) {
    return { error: 'Discount must be between 1 and 90 percent.' };
  }

  let expiresAt = data.expiresAt ?? null;
  if (data.validDays != null) {
    expiresAt = Date.now() + data.validDays * 24 * 60 * 60 * 1000;
  }

  const promo = {
    code,
    type: PROMO_TYPES.discount_percent,
    value,
    maxUses: data.maxUses ?? null,
    validDays: data.validDays ?? null,
    uses: 0,
    expiresAt,
    createdAt: Date.now(),
    createdBy: data.createdBy,
    note: data.note || null,
  };

  savePromo(guildId, promo);
  return { ok: true, promo };
}

function applyPromoToTicket(ticket, promo) {
  ticket.promoCode = promo.code;
  ticket.promoType = promo.type;
  ticket.promoValue = promo.value;
  return ticket;
}

function parseAmount(priceStr) {
  if (!priceStr) return null;
  const match = String(priceStr).match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function computePricing(baseAmount, promo) {
  const original = Number(baseAmount);
  if (!Number.isFinite(original)) {
    return { original: null, amountDue: null, hasNumericPrice: false };
  }

  if (!promo || promo.type !== PROMO_TYPES.discount_percent) {
    return {
      original,
      amountDue: original,
      hasNumericPrice: true,
      formattedDue: `€${original.toFixed(2)}`,
    };
  }

  const discountPercent = Number(promo.value) || 0;
  const amountDue = Math.round(original * (1 - discountPercent / 100) * 100) / 100;
  return {
    original,
    amountDue,
    discountPercent,
    hasNumericPrice: true,
    formattedDue: `€${amountDue.toFixed(2)}`,
    formattedOriginal: `€${original.toFixed(2)}`,
  };
}

function buildPromoAnnouncement(guildId, promo) {
  return new ContainerBuilder()
    .setAccentColor(getBrandColor(guildId))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## New Promo Code',
          '',
          `Use code **\`${promo.code}\`** in a **purchase ticket** — click **Redeem Discount** to apply.`,
          '',
          `**Offer:** ${promoLabel(promo)}`,
          `**Details:** ${formatPromoLimits(promo)}`,
          promo.note ? `\n**Note:** ${promo.note}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${brandFooter(guildId)}*`)
    );
}

async function announcePromo(channel, guildId, promo) {
  return channel.send({
    components: [buildPromoAnnouncement(guildId, promo)],
    flags: CV2,
  });
}

module.exports = {
  PROMO_TYPES: { discount_percent: 'discount_percent' },
  normalizeCode,
  getPromo,
  listPromos,
  deletePromo,
  validatePromo,
  consumePromo,
  createPromoRecord,
  applyPromoToTicket,
  promoLabel,
  formatPromoLimits,
  parseAmount,
  computePricing,
  buildPromoAnnouncement,
  announcePromo,
};
