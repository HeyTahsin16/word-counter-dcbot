const { SlashCommandBuilder } = require('discord.js');
const { checkWord } = require('../wordChecker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordcounter-lookup')
    .setDescription('Check if a word has been used in this server')
    .addStringOption(opt =>
      opt
        .setName('word')
        .setDescription('The word to look up')
        .setRequired(true)
    ),

  async execute(interaction, db) {
    const raw = interaction.options.getString('word').trim().toLowerCase();

    // Must be a single word
    if (raw.includes(' ')) {
      return interaction.reply({
        content: '❌ Please enter a single word (no spaces).',
        ephemeral: true,
      });
    }

    // Check if it's even a valid word
    const isValid = checkWord(raw);
    if (!isValid) {
      return interaction.reply({
        content: `🚫 **"${raw}"** is not a recognized English word — it wouldn't be valid in the game.`,
        ephemeral: true,
      });
    }

    const entry = db.getBlacklistedWord(interaction.guildId, raw);

    if (entry) {
      const timestamp = Math.floor(entry.addedAt / 1000);
      await interaction.reply({
        content: `🔴 **"${raw}"** has already been used by **${entry.username}** (<@${entry.userId}>) — <t:${timestamp}:R>.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `🟢 **"${raw}"** hasn't been said by anyone yet — it's fair game!`,
        ephemeral: true,
      });
    }
  },
};
