const store = require('../config/store');
const { buildPanelComponents, CV2 } = require('../utils/components');

function countActiveTickets(guildId) {
  const tickets = store.listTicketsForGuild(guildId).filter((t) => t.stage !== 'closed');
  const counters = { purchase: 0, support: 0, partner: 0 };
  for (const ticket of tickets) {
    if (counters[ticket.category] != null) {
      counters[ticket.category]++;
    }
  }
  return counters;
}

async function refreshAllPanels(client, guildId) {
  const config = store.getGuild(guildId);
  const messageIds = config.tickets?.panelMessageIds || [];
  if (!messageIds.length) return;

  const counters = countActiveTickets(guildId);
  const { components, files } = buildPanelComponents(guildId, counters);

  for (const entry of messageIds) {
    const channel = await client.channels.fetch(entry.channelId).catch(() => null);
    if (!channel?.isTextBased()) continue;
    const message = await channel.messages.fetch(entry.messageId).catch(() => null);
    if (!message) continue;

    await message
      .edit({ components, files, flags: CV2 })
      .catch((err) => console.warn('Panel refresh failed:', err.message));
  }
}

async function registerPanelMessage(guildId, channelId, messageId) {
  const config = store.getGuild(guildId);
  const panels = [...(config.tickets.panelMessageIds || [])];
  if (!panels.some((p) => p.messageId === messageId)) {
    panels.push({ channelId, messageId });
    store.setPath(guildId, 'tickets.panelMessageIds', panels);
  }
}

module.exports = {
  countActiveTickets,
  refreshAllPanels,
  registerPanelMessage,
};
