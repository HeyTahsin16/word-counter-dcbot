/**
 * Word Counter Bot — bot.js
 *
 * Uses sql.js (pure JS SQLite) so it works anywhere without native compilation.
 * On a dedicated server you can swap to better-sqlite3 for better performance.
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const initSqlJs = require("sql.js");
const fs        = require("fs");
const path      = require("path");
require("dotenv").config();

// Track message IDs deleted by the bot so messageDelete doesn't misfire
const botDeletedMessages = new Set();

// ── Database ───────────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, "data");
const DB_FILE   = path.join(DATA_DIR, "wordbot.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db; // sql.js Database instance

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (guild_id)
    );
    CREATE TABLE IF NOT EXISTS used_words (
      guild_id   TEXT NOT NULL,
      word       TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      username   TEXT NOT NULL,
      used_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (guild_id, word)
    );
    CREATE TABLE IF NOT EXISTS last_writer (
      guild_id TEXT NOT NULL,
      user_id  TEXT NOT NULL,
      PRIMARY KEY (guild_id)
    );
  `);

  saveDb();
}

function saveDb() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return query(sql, params)[0] ?? null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ── DB helpers ─────────────────────────────────────────────────────────────────
const getConfig       = (g)         => queryOne("SELECT * FROM config WHERE guild_id = ?", [g]);
const setConfig       = (g, ch)     => run("INSERT OR REPLACE INTO config (guild_id, channel_id, active) VALUES (?, ?, 1)", [g, ch]);
const disableConfig   = (g)         => run("UPDATE config SET active = 0 WHERE guild_id = ?", [g]);
const getUsed         = (g, w)      => queryOne("SELECT * FROM used_words WHERE guild_id = ? AND word = ?", [g, w]);
const insertUsed      = (g, w, u, n)=> run("INSERT OR IGNORE INTO used_words (guild_id, word, user_id, username) VALUES (?, ?, ?, ?)", [g, w, u, n]);
const deleteUsed      = (g, w)      => run("DELETE FROM used_words WHERE guild_id = ? AND word = ?", [g, w]);
const countUsed       = (g)         => queryOne("SELECT COUNT(*) as cnt FROM used_words WHERE guild_id = ?", [g])?.cnt ?? 0;
const topUsers        = (g)         => query("SELECT username, COUNT(*) as cnt FROM used_words WHERE guild_id = ? GROUP BY user_id ORDER BY cnt DESC LIMIT 10", [g]);
const recentWords     = (g)         => query("SELECT word, username FROM used_words WHERE guild_id = ? ORDER BY used_at DESC LIMIT 10", [g]);
const getLastWriter   = (g)         => queryOne("SELECT user_id FROM last_writer WHERE guild_id = ?", [g]);
const upsertLastWriter= (g, u)      => run("INSERT OR REPLACE INTO last_writer (guild_id, user_id) VALUES (?, ?)", [g, u]);

// ── Word list ─────────────────────────────────────────────────────────────────
let WORD_SET = new Set();

function loadWords() {
  const wordFile = path.join(DATA_DIR, "words.txt");
  if (!fs.existsSync(wordFile)) {
    console.warn("⚠  data/words.txt not found — run `node download-words.js` first.");
    return;
  }
  const raw = fs.readFileSync(wordFile, "utf8");
  let count = 0;
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (w) { WORD_SET.add(w); count++; }
  }
  console.log(`✅ Loaded ${count.toLocaleString()} words into memory.`);
}

const isValidWord = (word) => WORD_SET.has(word.toLowerCase());

// ── Slash commands ─────────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName("wordcounter")
    .setDescription("Start the Word Counter game in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("wordcounter-stop")
    .setDescription("Stop the Word Counter game in this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Check if a word has already been claimed (only you see this)")
    .addStringOption((o) =>
      o.setName("word").setDescription("The word to look up").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show the Word Counter leaderboard"),

  new SlashCommandBuilder()
    .setName("recent")
    .setDescription("Show the 10 most recently said words"),

  new SlashCommandBuilder()
    .setName("wordcount")
    .setDescription("Show how many unique words have been said so far"),
].map((c) => c.toJSON());

// ── Client ─────────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands registered globally.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
});

// ── Interactions ───────────────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild, channel } = interaction;

  if (commandName === "wordcounter") {
    setConfig(guild.id, channel.id);
    upsertLastWriter(guild.id, "");
    await interaction.reply(
      "✅ **Word Counter** is now active in this channel!\n\n" +
      "**How to play:**\n" +
      "• Type any **single valid English word** — if nobody's said it before, it's yours!\n" +
      "• You **cannot** say two words in a row — someone else must go between yours.\n" +
      "• Duplicates & gibberish are removed; you'll get a brief notice that only lasts a few seconds.\n" +
      "• If you **delete your word**, the bot announces it publicly so everyone knows it's free.\n\n" +
      "Use `/lookup <word>` to check if a word is taken (only you see the reply). Good luck! 🎉"
    );
    return;
  }

  if (commandName === "wordcounter-stop") {
    disableConfig(guild.id);
    await interaction.reply("🛑 Word Counter has been stopped for this server.");
    return;
  }

  if (commandName === "lookup") {
    const word = interaction.options.getString("word").toLowerCase().trim();
    const cfg  = getConfig(guild.id);
    if (!cfg || !cfg.active) {
      await interaction.reply({ content: "Word Counter isn't active in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const row = getUsed(guild.id, word);
    if (row) {
      await interaction.reply({ content: `🔍 **"${word}"** was already claimed by **${row.username}**.`, flags: MessageFlags.Ephemeral });
    } else if (!isValidWord(word)) {
      await interaction.reply({ content: `🔍 **"${word}"** hasn't been said — and it's not a recognised English word either!`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `🔍 **"${word}"** hasn't been said yet. Go claim it! 🟢`, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (commandName === "stats") {
    const cfg = getConfig(guild.id);
    if (!cfg || !cfg.active) {
      await interaction.reply({ content: "Word Counter isn't active in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const total = countUsed(guild.id);
    const top   = topUsers(guild.id);
    const lb    = top.map((r, i) => `${i + 1}. **${r.username}** — ${r.cnt} word${r.cnt !== 1 ? "s" : ""}`).join("\n") || "No data yet.";
    await interaction.reply(`📊 **Word Counter Stats**\n\nTotal unique words: **${total.toLocaleString()}**\n\n🏆 **Top Contributors:**\n${lb}`);
    return;
  }

  if (commandName === "recent") {
    const cfg = getConfig(guild.id);
    if (!cfg || !cfg.active) {
      await interaction.reply({ content: "Word Counter isn't active in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const rows = recentWords(guild.id);
    if (!rows.length) { await interaction.reply("No words have been said yet!"); return; }
    const list = rows.map((r, i) => `${i + 1}. **${r.word}** — ${r.username}`).join("\n");
    await interaction.reply(`🕐 **10 Most Recently Said Words:**\n${list}`);
    return;
  }

  if (commandName === "wordcount") {
    const cfg = getConfig(guild.id);
    if (!cfg || !cfg.active) {
      await interaction.reply({ content: "Word Counter isn't active in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const total = countUsed(guild.id);
    await interaction.reply(`📝 **${total.toLocaleString()}** unique word${total !== 1 ? "s" : ""} said so far!`);
    return;
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Send a temporary message visible to everyone but auto-deleted after `ms` ms.
 * Mentions the target user so only they get a notification ping — everyone else
 * sees it flash briefly and it disappears. Clean, no DMs needed.
 */
async function tempMsg(channel, userId, text, ms = 6000) {
  const msg = await channel.send(`<@${userId}> ${text}`).catch(() => null);
  if (msg) setTimeout(() => msg.delete().catch(() => {}), ms);
}

// ── Messages ───────────────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const cfg = getConfig(message.guild.id);
  if (!cfg || !cfg.active || message.channel.id !== cfg.channel_id) return;
  if (message.content.startsWith("/")) return;

  const raw  = message.content.trim();
  const word = raw.toLowerCase();

  // Single word only (no spaces)
  if (!raw || /\s/.test(raw)) return;

  // Anti-spam: no consecutive words by the same user
  const lastWriter = getLastWriter(message.guild.id);
  if (lastWriter && lastWriter.user_id === message.author.id) {
    botDeletedMessages.add(message.id);
    await message.delete().catch(() => {});
    await tempMsg(message.channel, message.author.id,
      "⛔ You can't say two words in a row! Wait for someone else first.");
    return;
  }

  // Blacklist check first (most likely rejection in active games)
  const existing = getUsed(message.guild.id, word);
  if (existing) {
    botDeletedMessages.add(message.id);
    await message.delete().catch(() => {});
    await tempMsg(message.channel, message.author.id,
      `🚫 **"${word}"** was already claimed by **${existing.username}**. Try a different word!`);
    return;
  }

  // Validate against word list
  if (!isValidWord(word)) {
    botDeletedMessages.add(message.id);
    await message.delete().catch(() => {});
    await tempMsg(message.channel, message.author.id,
      `❌ **"${raw}"** isn't a recognised English word. Try again!`);
    return;
  }

  // Accept
  const username = message.member?.displayName ?? message.author.username;
  insertUsed(message.guild.id, word, message.author.id, username);
  upsertLastWriter(message.guild.id, message.author.id);
});

// ── Message delete ─────────────────────────────────────────────────────────────
client.on("messageDelete", async (message) => {
  // Bot deleted this message — don't treat it as a user deletion
  if (botDeletedMessages.delete(message.id)) return;

  if (message.author?.bot || !message.guild) return;

  const cfg = getConfig(message.guild.id);
  if (!cfg || !cfg.active || message.channel.id !== cfg.channel_id) return;

  const raw = message.content?.trim();
  if (!raw || /\s/.test(raw)) return;

  const word = raw.toLowerCase();
  const row  = getUsed(message.guild.id, word);

  if (row && row.user_id === message.author.id) {
    deleteUsed(message.guild.id, word);

    // Let the deleter go next
    const lw = getLastWriter(message.guild.id);
    if (lw && lw.user_id === message.author.id) upsertLastWriter(message.guild.id, "");

    message.channel.send(`🗑️ **${row.username}** deleted their word **"${word}"** — it's now free for anyone to claim!`).catch(() => {});
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────────
(async () => {
  await initDb();
  loadWords();
  await client.login(process.env.DISCORD_TOKEN);
})();
