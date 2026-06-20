const TIERS = [5, 10, 25, 50, 100];

/** Round EUR amount to nearest PaySafe card tier (always rounds up to valid tier). */
function roundToPaysafeTier(amountEur) {
  const amount = Number(amountEur);
  if (!Number.isFinite(amount) || amount <= 0) return TIERS[0];
  for (const tier of TIERS) {
    if (amount <= tier) return tier;
  }
  return TIERS[TIERS.length - 1];
}

function formatPaysafeInstructions(baseInstructions, amountEur) {
  const tier = roundToPaysafeTier(amountEur);
  return [
    baseInstructions,
    '',
    `**PaySafe card tier:** €${tier}`,
    `_Rounded from €${Number(amountEur).toFixed(2)} to the nearest available card._`,
  ].join('\n');
}

function formatPaypalInstructions(config, amountEur, username) {
  const lines = [
    config.instructions || 'Send payment via PayPal.',
    '',
    `**PayPal email:** \`${config.email}\``,
  ];
  if (amountEur != null && Number.isFinite(Number(amountEur))) {
    lines.push(`**Amount:** €${Number(amountEur).toFixed(2)}`);
  }
  if (username) {
    lines.push(`**Include in note:** \`${username}\``);
  }
  return lines.join('\n');
}

module.exports = {
  TIERS,
  roundToPaysafeTier,
  formatPaysafeInstructions,
  formatPaypalInstructions,
};
