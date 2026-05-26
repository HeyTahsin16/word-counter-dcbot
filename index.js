require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./src/database');
const { checkWord } = require('./src/wordChecker');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// Load slash commands
const commandFiles = fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(`./src/commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
}

// Register slash commands with Discord
async function registerCommands() {
  const commands = [];
  for (const file of commandFiles) {
    const cmd = require(`./src/commands/${file}`);
    commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered globally.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  db.init();
  await registerCommands();
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, db);
  } catch (err) {
    console.error(err);
    const msg = { content: '❌ An error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

// Handle messages in active channels
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const channelConfig = db.getChannel(message.guildId, message.channelId);
  if (!channelConfig) return; // Not a word-counter channel

  const raw = message.content.trim().toLowerCase();

  // Must be a single word (no spaces)
  if (!raw || raw.includes(' ') || raw.includes('\n')) {
    await message.delete().catch(() => {});
    return;
  }

  const word = raw;

  // 1. Check blacklist first (already used words)
  const blacklisted = db.getBlacklistedWord(message.guildId, word);
  if (blacklisted) {
    await message.delete().catch(() => {});

    // Ephemeral-style: send DM or temp message visible only to that user via reply then delete
    const tagger = `<@${blacklisted.userId}>`;
    const tempMsg = await message.channel.send({
      content: `<@${message.author.id}> ❌ The word **"${word}"** was already used by ${tagger}!`,
      allowedMentions: { users: [message.author.id] },
    });

    // Delete the temp message after 6 seconds
    setTimeout(() => tempMsg.delete().catch(() => {}), 6000);
    return;
  }

  // 2. Check if the word is valid English
  const isValid = checkWord(word);
  if (!isValid) {
    await message.delete().catch(() => {});
    return;
  }

  // 3. Enforce turn: last player cannot go again until someone else plays
  const lastEntry = db.getLastEntry(message.guildId, message.channelId);
  if (lastEntry && lastEntry.userId === message.author.id) {
    await message.delete().catch(() => {});
    const tempMsg = await message.channel.send({
      content: `<@${message.author.id}> ⏳ Wait for someone else to say a word before you go again!`,
      allowedMentions: { users: [message.author.id] },
    });
    setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
    return;
  }

  // 4. All good — record word
  db.addWord(message.guildId, message.channelId, word, message.author.id, message.author.username, message.id);
});

// Handle message deletions (if someone deletes their word, notify the channel)
client.on('messageDelete', async message => {
  if (!message.guildId) return;

  const channelConfig = db.getChannel(message.guildId, message.channelId);
  if (!channelConfig) return;

  const entry = db.getEntryByMessageId(message.id);
  if (!entry) return;

  // Remove from blacklist and entries
  db.removeWordByMessageId(message.id);

  await message.channel.send({
    content: `🗑️ <@${entry.userId}> removed their word **"${entry.word}"** — it's back in play!`,
    allowedMentions: { parse: [] },
  });
});

client.login(process.env.BOT_TOKEN);
