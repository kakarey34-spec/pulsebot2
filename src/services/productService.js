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
const store = require('../config/store');
const { getBrandColor, brandFooter, LOGO_PATH, logoExists } = require('../utils/brand');

const CV2 = MessageFlags.IsComponentsV2;

function buildProductContainer(guildId, product) {
  const container = new ContainerBuilder()
    .setAccentColor(getBrandColor(guildId))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${product.name}`,
          '',
          product.description,
          '',
          `**Price:** ${product.price}`,
          `**Listed by:** <@${product.sellerId}>`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${brandFooter(guildId)} · Product ID: \`${product.id}\`*`)
    );

  return container;
}

async function postProduct(client, guildId, sellerId, data) {
  const config = store.getGuild(guildId);
  const shopChannelId = config.channels.shopChannelId;
  if (!shopChannelId) {
    return { error: 'Shop channel is not configured. Ask an owner to run `/config channel shop`.' };
  }

  const channel = await client.channels.fetch(shopChannelId).catch(() => null);
  if (!channel?.isTextBased()) {
    return { error: 'Shop channel could not be found.' };
  }

  const id = `prod_${Date.now().toString(36)}`;
  const product = {
    id,
    name: data.name,
    description: data.description,
    price: data.price,
    sellerId,
    imageUrl: data.imageUrl || null,
    messageId: null,
    channelId: shopChannelId,
    createdAt: Date.now(),
  };

  const components = [buildProductContainer(guildId, product)];
  const files = [];

  if (data.imageAttachment) {
    files.push(data.imageAttachment);
    components.unshift(
      new MediaGalleryBuilder().addItems((item) =>
        item.setDescription(product.name).setURL(`attachment://${data.imageAttachment.name}`)
      )
    );
  } else if (product.imageUrl) {
    components.unshift(
      new MediaGalleryBuilder().addItems((item) =>
        item.setDescription(product.name).setURL(product.imageUrl)
      )
    );
  }

  const message = await channel.send({
    components,
    files,
    flags: CV2,
  });

  product.messageId = message.id;
  const products = { ...(config.products || {}) };
  products[id] = product;
  store.setPath(guildId, 'products', products);

  return { ok: true, product, message };
}

function listProducts(guildId) {
  const config = store.getGuild(guildId);
  return Object.values(config.products || {}).sort((a, b) => b.createdAt - a.createdAt);
}

function getProduct(guildId, productId) {
  const config = store.getGuild(guildId);
  return config.products?.[productId] || null;
}

async function removeProduct(client, guildId, productId) {
  const product = getProduct(guildId, productId);
  if (!product) return { error: 'Product not found.' };

  const channel = await client.channels.fetch(product.channelId).catch(() => null);
  if (channel?.isTextBased() && product.messageId) {
    const message = await channel.messages.fetch(product.messageId).catch(() => null);
    if (message) await message.delete().catch(() => null);
  }

  const config = store.getGuild(guildId);
  const products = { ...(config.products || {}) };
  delete products[productId];
  store.setPath(guildId, 'products', products);
  return { ok: true };
}

module.exports = {
  postProduct,
  listProducts,
  getProduct,
  removeProduct,
  buildProductContainer,
};
