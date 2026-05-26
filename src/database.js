/**
 * Database layer using JSON flat files.
 * Two files:
 *   data/channels.json  — { "guildId:channelId": { guildId, channelId, setupBy, setupAt } }
 *   data/words.json     — { "guildId:word": { word, userId, username, guildId, channelId, messageId, addedAt } }
 *   data/entries.json   — { "messageId": { word, userId, username, guildId, channelId } }
 *   data/lastEntry.json — { "guildId:channelId": { userId, word, messageId } }
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return {};
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return {};
  }
}

function save(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

module.exports = {
  init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    ['channels', 'words', 'entries', 'lastEntry'].forEach(n => {
      if (!fs.existsSync(filePath(n))) save(n, {});
    });
    console.log('✅ Database initialized.');
  },

  // ── Channels ──────────────────────────────────────────────────────────────
  setChannel(guildId, channelId, userId) {
    const db = load('channels');
    db[`${guildId}:${channelId}`] = { guildId, channelId, setupBy: userId, setupAt: Date.now() };
    save('channels', db);
  },

  getChannel(guildId, channelId) {
    const db = load('channels');
    return db[`${guildId}:${channelId}`] || null;
  },

  removeChannel(guildId, channelId) {
    const db = load('channels');
    delete db[`${guildId}:${channelId}`];
    save('channels', db);
  },

  // ── Words (blacklist) ─────────────────────────────────────────────────────
  addWord(guildId, channelId, word, userId, username, messageId) {
    const words = load('words');
    const entries = load('entries');
    const lastEntry = load('lastEntry');

    const key = `${guildId}:${word}`;
    words[key] = { word, userId, username, guildId, channelId, messageId, addedAt: Date.now() };
    entries[messageId] = { word, userId, username, guildId, channelId };
    lastEntry[`${guildId}:${channelId}`] = { userId, word, messageId };

    save('words', words);
    save('entries', entries);
    save('lastEntry', lastEntry);
  },

  getBlacklistedWord(guildId, word) {
    const db = load('words');
    return db[`${guildId}:${word}`] || null;
  },

  getEntryByMessageId(messageId) {
    const db = load('entries');
    return db[messageId] || null;
  },

  removeWordByMessageId(messageId) {
    const entries = load('entries');
    const entry = entries[messageId];
    if (!entry) return;

    const words = load('words');
    const lastEntry = load('lastEntry');

    delete words[`${entry.guildId}:${entry.word}`];
    delete entries[messageId];

    // If this was the last entry, clear it
    const lk = `${entry.guildId}:${entry.channelId}`;
    if (lastEntry[lk] && lastEntry[lk].messageId === messageId) {
      delete lastEntry[lk];
    }

    save('words', words);
    save('entries', entries);
    save('lastEntry', lastEntry);
  },

  getLastEntry(guildId, channelId) {
    const db = load('lastEntry');
    return db[`${guildId}:${channelId}`] || null;
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats(guildId) {
    const words = load('words');
    const stats = {};
    for (const [key, entry] of Object.entries(words)) {
      if (entry.guildId !== guildId) continue;
      if (!stats[entry.userId]) {
        stats[entry.userId] = { username: entry.username, count: 0 };
      }
      stats[entry.userId].count++;
    }
    return stats;
  },

  getTotalWords(guildId) {
    const words = load('words');
    return Object.values(words).filter(w => w.guildId === guildId).length;
  },

  // ── Reset ─────────────────────────────────────────────────────────────────
  resetChannel(guildId, channelId) {
    const words = load('words');
    const entries = load('entries');
    const lastEntry = load('lastEntry');

    // Remove all words from this guild/channel
    for (const key of Object.keys(words)) {
      if (words[key].guildId === guildId && words[key].channelId === channelId) {
        delete words[key];
      }
    }
    for (const key of Object.keys(entries)) {
      if (entries[key].guildId === guildId && entries[key].channelId === channelId) {
        delete entries[key];
      }
    }
    delete lastEntry[`${guildId}:${channelId}`];

    save('words', words);
    save('entries', entries);
    save('lastEntry', lastEntry);
  },
};
