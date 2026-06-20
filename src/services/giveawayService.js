const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const store = require('../config/store');
const { getBrandColor, brandFooter } = require('../utils/brand');
const { formatDuration } = require('../utils/parseDuration');

const ENTER_PREFIX = 'giveaway_enter:';
const MAX_WINNERS = 20;
const CV2 = MessageFlags.IsComponentsV2;

function enterButton(messageId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ENTER_PREFIX}${messageId}`)
      .setLabel('Enter Giveaway')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎉')
      .setDisabled(disabled)
  );
}

function buildGiveawayContainer(giveaway) {
  const ended = giveaway.status === 'ended' || Date.now() >= giveaway.endsAt;
  const endsUnix = Math.floor(giveaway.endsAt / 1000);
  const entries = giveaway.entrants?.length || 0;

  const lines = [
    ended ? `## 🎉 Giveaway Ended — ${giveaway.title}` : `## 🎉 ${giveaway.title}`,
    '',
    `**Prize:** ${giveaway.prize}`,
    giveaway.description ? `\n${giveaway.description}` : '',
    '',
    `**Winners:** ${giveaway.winnerCount}`,
    `**Entries:** ${entries}`,
    ended
      ? `**Ended:** <t:${endsUnix}:R>`
      : `**Ends:** <t:${endsUnix}:F> (<t:${endsUnix}:R>)`,
    `**Hosted by:** <@${giveaway.hostId}>`,
  ].filter(Boolean);

  if (ended && giveaway.winnerIds?.length) {
    lines.push('', `**Winner(s):** ${giveaway.winnerIds.map((id) => `<@${id}>`).join(', ')}`);
  } else if (ended) {
    lines.push('', '**Winner(s):** _No valid entries_');
  }

  return new ContainerBuilder()
    .setAccentColor(ended ? 0x8b8b8b : getBrandColor(giveaway.guildId))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ended ? '*This giveaway has ended*' : '*Click the button below to enter*'
      )
    );
}

function pickWinners(entrants, count) {
  const pool = [...new Set(entrants)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

async function refreshGiveawayMessage(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  const ended = giveaway.status === 'ended';
  await message.edit({
    components: [buildGiveawayContainer(giveaway), ...(ended ? [] : [enterButton(giveaway.messageId)])],
    flags: CV2,
  });
}

async function getValidEntrants(guild, giveaway) {
  const valid = [];
  for (const userId of giveaway.entrants || []) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && !member.user.bot) valid.push(userId);
  }
  return valid;
}

async function endGiveaway(client, messageId, { force = false, endedBy = null } = {}) {
  const giveaway = store.getGiveaway(messageId);
  if (!giveaway) return { error: 'Giveaway not found.' };
  if (giveaway.status === 'ended') {
    return { error: 'Giveaway already ended. Use `/giveaway reroll` to replace invalid winners.' };
  }
  if (!force && Date.now() < giveaway.endsAt) {
    return { error: 'This giveaway is still running.' };
  }

  const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) {
    store.deleteGiveaway(messageId);
    return { error: 'Guild not found.' };
  }

  const validEntrants = await getValidEntrants(guild, giveaway);
  const winnerIds = pickWinners(validEntrants, giveaway.winnerCount);
  giveaway.status = 'ended';
  giveaway.endedAt = Date.now();
  giveaway.winnerIds = winnerIds;
  if (endedBy) giveaway.endedBy = endedBy;
  store.setGiveaway(messageId, giveaway);

  await refreshGiveawayMessage(client, giveaway);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    if (!winnerIds.length) {
      await channel
        .send({ content: `Giveaway **${giveaway.title}** ended with no eligible entries.` })
        .catch(() => null);
    } else {
      const mentions = winnerIds.map((id) => `<@${id}>`).join(' ');
      await channel
        .send({
          content: `🎉 Congratulations ${mentions}! You won **${giveaway.prize}** — ${giveaway.title}`,
          allowedMentions: { users: winnerIds },
        })
        .catch(() => null);
    }
  }

  return { ok: true, winnerIds, giveaway };
}

async function rerollGiveaway(client, messageId, replaceUserId) {
  const giveaway = store.getGiveaway(messageId);
  if (!giveaway) return { error: 'Giveaway not found.' };
  if (giveaway.status !== 'ended') {
    return { error: 'Only ended giveaways can be rerolled.' };
  }

  const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) return { error: 'Guild not found.' };

  const winners = giveaway.winnerIds || [];
  if (!winners.includes(replaceUserId)) {
    return { error: 'That user is not a listed winner for this giveaway.' };
  }

  const pool = (await getValidEntrants(guild, giveaway)).filter(
    (id) => !winners.includes(id) || id === replaceUserId
  );
  const rerollPool = pool.filter((id) => id !== replaceUserId);
  if (!rerollPool.length) return { error: 'No other eligible entrants to pick from.' };

  const [newWinner] = pickWinners(rerollPool, 1);
  giveaway.winnerIds = winners.map((id) => (id === replaceUserId ? newWinner : id));
  store.setGiveaway(messageId, giveaway);
  await refreshGiveawayMessage(client, giveaway);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel
      .send({
        content: `🎉 Reroll: <@${newWinner}> you won **${giveaway.prize}** — ${giveaway.title}`,
        allowedMentions: { users: [newWinner] },
      })
      .catch(() => null);
  }

  return { ok: true, newWinner, replaced: replaceUserId };
}

async function handleEnter(interaction) {
  const messageId = interaction.customId.slice(ENTER_PREFIX.length);
  const giveaway = store.getGiveaway(messageId);

  if (!giveaway || giveaway.guildId !== interaction.guild.id) {
    return interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
  }
  if (giveaway.status === 'ended' || Date.now() >= giveaway.endsAt) {
    return interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
  }
  if (interaction.user.bot) {
    return interaction.reply({ content: 'Bots cannot enter giveaways.', ephemeral: true });
  }

  const entrants = giveaway.entrants || [];
  if (entrants.includes(interaction.user.id)) {
    return interaction.reply({ content: 'You are already entered.', ephemeral: true });
  }

  giveaway.entrants = [...entrants, interaction.user.id];
  store.setGiveaway(messageId, giveaway);
  await refreshGiveawayMessage(interaction.client, giveaway);

  return interaction.reply({
    content: `You entered **${giveaway.title}**! Good luck — prize: **${giveaway.prize}**.`,
    ephemeral: true,
  });
}

async function startGiveaway(interaction, opts) {
  const durationMs = opts.durationMs;
  if (!durationMs || durationMs < 60 * 1000) {
    return { error: 'Duration must be at least 1 minute (e.g. `30m`, `1h`, `2d`).' };
  }
  if (durationMs > 365 * 24 * 60 * 60 * 1000) {
    return { error: 'Duration cannot be longer than 365 days.' };
  }

  const winnerCount = opts.winnerCount;
  if (winnerCount < 1 || winnerCount > MAX_WINNERS) {
    return { error: `Winner count must be between 1 and ${MAX_WINNERS}.` };
  }

  const channel = opts.channel || interaction.channel;
  if (!channel?.isTextBased()) return { error: 'Choose a text channel.' };

  const endsAt = Date.now() + durationMs;
  const preview = {
    title: opts.title,
    prize: opts.prize,
    description: opts.description || null,
    hostId: interaction.user.id,
    winnerCount,
    endsAt,
    entrants: [],
    status: 'active',
    guildId: interaction.guild.id,
    channelId: channel.id,
    messageId: 'pending',
  };

  const message = await channel.send({
    components: [buildGiveawayContainer({ ...preview, guildId: interaction.guild.id }), enterButton('pending')],
    flags: CV2,
  });

  const giveaway = { ...preview, messageId: message.id, createdAt: Date.now() };
  store.setGiveaway(message.id, giveaway);

  await message.edit({
    components: [buildGiveawayContainer(giveaway), enterButton(message.id)],
    flags: CV2,
  });

  return { ok: true, message, endsIn: formatDuration(durationMs) };
}

function isEnterButton(customId) {
  return customId.startsWith(ENTER_PREFIX);
}

module.exports = {
  ENTER_PREFIX,
  MAX_WINNERS,
  startGiveaway,
  endGiveaway,
  rerollGiveaway,
  handleEnter,
  isEnterButton,
};
