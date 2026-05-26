const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordcounter-disable')
    .setDescription('Disable the Word Counter in this channel (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, db) {
    const { guildId, channelId } = interaction;

    const existing = db.getChannel(guildId, channelId);
    if (!existing) {
      return interaction.reply({
        content: '❌ This channel is not a Word Counter channel.',
        ephemeral: true,
      });
    }

    db.removeChannel(guildId, channelId);

    await interaction.reply({
      content: '🛑 Word Counter has been **disabled** in this channel. History is preserved. Use `/wordcounter-setup` to re-enable.',
    });
  },
};
