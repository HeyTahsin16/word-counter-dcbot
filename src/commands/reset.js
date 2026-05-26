const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordcounter-reset')
    .setDescription('Reset the Word Counter — clears all used words (Admin only)')
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

    db.resetChannel(guildId, channelId);

    await interaction.reply({
      content: '🔄 **Word Counter has been reset!** All used words have been cleared. Start fresh!',
    });
  },
};
