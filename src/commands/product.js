const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { LEVELS } = require('../utils/permissions');
const productService = require('../services/productService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('product')
    .setDescription('Manage shop products (sellers+)')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Post a product to the shop')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Product name').setRequired(true).setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('Detailed description')
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption((opt) =>
          opt
            .setName('price')
            .setDescription('Price (e.g. €25.00)')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addAttachmentOption((opt) =>
          opt.setName('image').setDescription('Product image (optional)')
        )
        .addStringOption((opt) =>
          opt.setName('image_url').setDescription('Image URL instead of attachment (optional)')
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List products in the shop'))
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a product (mod+ or original seller)')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Product ID from the shop post').setRequired(true)
        )
    ),
  permissionLevel: LEVELS.seller,
  permissionLabel: 'seller',
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });

      const attachment = interaction.options.getAttachment('image');
      const imageUrl = interaction.options.getString('image_url');

      let imageAttachment = null;
      if (attachment?.contentType?.startsWith('image/')) {
        imageAttachment = new AttachmentBuilder(attachment.url, { name: attachment.name || 'product.png' });
      }

      const result = await productService.postProduct(client, interaction.guild.id, interaction.user.id, {
        name: interaction.options.getString('name'),
        description: interaction.options.getString('description'),
        price: interaction.options.getString('price'),
        imageUrl: imageUrl || null,
        imageAttachment,
      });

      if (result.error) return interaction.editReply({ content: result.error });
      return interaction.editReply({
        content: `Product **${result.product.name}** posted to <#${result.product.channelId}> — ID: \`${result.product.id}\``,
      });
    }

    if (sub === 'list') {
      const products = productService.listProducts(interaction.guild.id);
      if (!products.length) {
        return interaction.reply({ content: 'No products in the shop yet.', ephemeral: true });
      }
      const lines = products.slice(0, 15).map(
        (p) => `• **${p.name}** — ${p.price} — \`${p.id}\` — <@${p.sellerId}>`
      );
      return interaction.reply({
        content: `**Shop products**\n${lines.join('\n')}`,
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const productId = interaction.options.getString('id');
      const product = productService.getProduct(interaction.guild.id, productId);
      if (!product) {
        return interaction.reply({ content: 'Product not found.', ephemeral: true });
      }

      const { canUse, LEVELS: L } = require('../utils/permissions');
      if (product.sellerId !== interaction.user.id && !canUse(interaction.member, L.mod)) {
        return interaction.reply({
          content: 'You can only remove your own products (mods can remove any).',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await productService.removeProduct(client, interaction.guild.id, productId);
      if (result.error) return interaction.editReply({ content: result.error });
      return interaction.editReply({ content: `Removed product \`${productId}\`.` });
    }
  },
};
