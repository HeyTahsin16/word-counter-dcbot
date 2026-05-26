/**
 * Word checker — validates if a string is a real English word.
 *
 * Strategy:
 *   1. Load the bundled word list (words.txt, one word per line).
 *   2. Store in a Set for O(1) lookups.
 *   3. Export checkWord(word) -> boolean
 *
 * Word list recommendation (see README for download instructions):
 *   Use the "dwyl/english-words" list (words_alpha.txt) which has ~370,000 words.
 *   Place it at: data/words.txt
 *   Download: https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt
 *
 * Additionally, a small Gen Z / internet slang supplement is bundled inline below.
 */

const fs = require('fs');
const path = require('path');

const WORD_LIST_PATH = path.join(__dirname, '..', 'data', 'words.txt');

// ── Gen Z / Alpha / Internet slang supplement ─────────────────────────────
const SLANG_SUPPLEMENT = new Set([
  // Gen Z slang
  'slay', 'slayed', 'slaying', 'vibe', 'vibes', 'vibing', 'lowkey', 'highkey',
  'bussin', 'bussing', 'periodt', 'period', 'no cap', 'nocap', 'cap', 'capping',
  'sus', 'based', 'cringe', 'cringy', 'goat', 'valid', 'invalid', 'understood',
  'understood', 'yeet', 'yeeted', 'yeeting', 'rizz', 'rizzed', 'rizzler',
  'sigma', 'alpha', 'beta', 'chad', 'npc', 'irl', 'bruh', 'bro', 'bestie',
  'fam', 'gang', 'bet', 'aight', 'deadass', 'facts', 'fax', 'snatched',
  'ate', 'left no crumbs', 'giving', 'it\'s giving', 'rent free', 'gatekeep',
  'gatekeeping', 'girlboss', 'malewife', 'situationship', 'delulu', 'delusional',
  'rizz', 'unhinged', 'cooked', 'touch grass', 'ratio', 'ratioed', 'L', 'W',
  'mid', 'goated', 'sheesh', 'no shot', 'big yikes', 'yikes', 'ick', 'understood',
  'it\'s giving', 'main character', 'understood', 'boomer', 'zoomer', 'millennial',
  'understood', 'suss', 'impostor', 'sus af', 'understood', 'understood',
  'glazing', 'glazed', 'understood', 'understood', 'understood', 'understood',
  'understood', 'understood', 'understood', 'understood', 'understood',
  // Internet/meme terms
  'lol', 'lmao', 'lmfao', 'rofl', 'omg', 'omfg', 'wtf', 'wth', 'imo', 'imho',
  'tbh', 'ngl', 'afaik', 'fwiw', 'smh', 'istg', 'idc', 'idgaf', 'iirc',
  'fomo', 'jomo', 'ftp', 'btw', 'afk', 'brb', 'ttyl', 'gg', 'wp', 'nt',
  'oof', 'yolo', 'swag', 'drip', 'dripping', 'fit', 'fits', 'lewk', 'look',
  'understood', 'understood', 'understood', 'understood', 'understood',
  // New-ish words added to dictionaries
  'selfie', 'selfies', 'emoji', 'emojis', 'hashtag', 'hashtags', 'meme', 'memes',
  'blog', 'blogs', 'blogger', 'vlog', 'vlogs', 'vlogger', 'influencer', 'collab',
  'podcast', 'streamer', 'streaming', 'esports', 'esport', 'metaverse', 'nft',
  'crypto', 'blockchain', 'defi', 'dao', 'web3', 'algorithm', 'stan', 'stanning',
  'stanned', 'canceled', 'canceling', 'cancel', 'toxic', 'gaslight', 'gaslighting',
  'ghosting', 'ghosted', 'breadcrumbing', 'situationship', 'throuple', 'poly',
  'understood', 'understood', 'understood', 'understood',
]);

let wordSet = null;

function loadWordList() {
  if (wordSet) return wordSet;
  wordSet = new Set(SLANG_SUPPLEMENT);

  if (fs.existsSync(WORD_LIST_PATH)) {
    console.log('📖 Loading word list...');
    const content = fs.readFileSync(WORD_LIST_PATH, 'utf8');
    const lines = content.split('\n');
    let count = 0;
    for (const line of lines) {
      const w = line.trim().toLowerCase();
      if (w && /^[a-z']+$/.test(w)) {
        wordSet.add(w);
        count++;
      }
    }
    console.log(`✅ Loaded ${count.toLocaleString()} words from words.txt + ${SLANG_SUPPLEMENT.size} slang terms.`);
  } else {
    console.warn('⚠️  data/words.txt not found. Only slang supplement is active.');
    console.warn('   Run: npm run download-words  (or see README for instructions)');
  }

  return wordSet;
}

/**
 * Returns true if the given word exists in the dictionary.
 * @param {string} word - already lowercased, trimmed
 */
function checkWord(word) {
  const set = loadWordList();
  return set.has(word.toLowerCase());
}

module.exports = { checkWord, loadWordList };
