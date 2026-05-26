const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordcounter-setup')
    .setDescription('Initialize this channel as a Word Counter channel (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, db) {
    const { guildId, channelId } = interaction;

    const existing = db.getChannel(guildId, channelId);
    if (existing) {
      return interaction.reply({
        content: '⚠️ This channel is already a Word Counter channel!',
        ephemeral: true,
      });
    }

    db.setChannel(guildId, channelId, interaction.user.id);

    await interaction.reply({
      content: [
        '✅ **Word Counter channel is now active!**',
        '',
        '**How it works:**',
        '• Members type **one word at a time** in this channel.',
        '• Each word can only be said **once** — duplicates are silently removed.',
        '• You **cannot say two words in a row** — wait for someone else to go.',
        '• If you delete your word, the channel is notified so everyone knows.',
        '• Random gibberish / non-English words are auto-removed.',
        '',
        'Use `/wordcounter-lookup <word>` to check if a word has been used.',
        'Use `/wordcounter-stats` to see the leaderboard.',
      ].join('\n'),
    });
  },
};
