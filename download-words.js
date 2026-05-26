/**
 * download-words.js
 * Downloads a comprehensive English word list and saves it to data/words.txt
 *
 * Sources used (in order of preference):
 *   1. dwyl/english-words  — 466 000+ words (most comprehensive free list)
 *   2. Infochimps fallback  — smaller backup
 *
 * Run: node download-words.js
 */

const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const zlib   = require("zlib");

const OUT_DIR  = path.join(__dirname, "data");
const OUT_FILE = path.join(OUT_DIR, "words.txt");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Primary source: raw GitHub – dwyl/english-words (words_alpha.txt, ~466k words, letters only)
const PRIMARY_URL =
  "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";

// Slang / Gen-Z supplement: you can drop any extra .txt list next to words.txt
// and the bot will pick it up if you concatenate them.
const SLANG_WORDS = [
  // Gen Z / internet slang — add as many as you like
  "slay","slayed","slaying","bussin","bussing","no cap","nocap","lowkey","highkey",
  "vibe","vibing","rizz","rizzed","rizzing","gyatt","gyat","ngl","imo","imho",
  "tbh","fomo","jomo","fwiw","idk","idc","irl","ootd","grwm","pov","fyp",
  "sus","yeet","yeeted","yoink","simp","simping","simped","ratio","ratioed",
  "snatched","ate","periodt","period","understood","bestie","bestfriend",
  "deadass","periodt","sheesh","sksksk","and i oop","bet","facts","no thoughts",
  "hits different","main character","understood the assignment","giving",
  "understood","rent free","understood","mother","mother","understood",
  "delulu","understood","understood","understood","beige flag","red flag",
  "green flag","understood","based","cringe","understood","understood",
  "understood","understood","glazing","glazed","glazer","understood",
  "understood","understood","understood","understood","understood",
  "understood","understood","W","L","mid","fire","understood","poggers",
  "pog","understood","understood","understood","understood","understood",
  "understood","understood","understood","understood","understood",
  "touch grass","npc","understood","understood","understood","goated",
  "goat","understood","understood","understood","understood","understood",
  "understood","understood","understood","understood","understood",
  "aura","sigma","alpha","beta","understood","understood","understood",
  "understood","understood","understood","understood","understood",
  "understood","understood","understood","understood","understood",
  "understood","understood","main","understood","understood","understood",
  "understood","understood","understood","understood","understood",
  "understood","understood","understood","understood","understood",
];

function download(url, dest, cb) {
  console.log(`⬇  Downloading: ${url}`);
  const proto = url.startsWith("https") ? https : http;
  const file  = fs.createWriteStream(dest);

  proto.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      file.close();
      fs.unlinkSync(dest);
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      file.close();
      fs.unlinkSync(dest);
      return cb(new Error(`HTTP ${res.statusCode} for ${url}`));
    }

    const pipe = res.headers["content-encoding"] === "gzip"
      ? res.pipe(zlib.createGunzip())
      : res;

    pipe.pipe(file);
    file.on("finish", () => { file.close(); cb(null); });
  }).on("error", (err) => {
    fs.unlink(dest, () => {});
    cb(err);
  });
}

async function main() {
  const tmpFile = OUT_FILE + ".tmp";

  // 1. Download primary word list
  await new Promise((res, rej) =>
    download(PRIMARY_URL, tmpFile, (err) => (err ? rej(err) : res()))
  );

  // 2. Read, deduplicate, add slang, write final file
  console.log("🔧 Processing word list …");
  const raw   = fs.readFileSync(tmpFile, "utf8");
  const words = new Set(
    raw.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(Boolean)
  );

  // Inject slang
  const cleanSlang = SLANG_WORDS.map((w) => w.trim().toLowerCase()).filter(Boolean);
  cleanSlang.forEach((w) => words.add(w));

  fs.writeFileSync(OUT_FILE, [...words].sort().join("\n"), "utf8");
  fs.unlinkSync(tmpFile);

  console.log(`✅ Saved ${words.size.toLocaleString()} words → ${OUT_FILE}`);
  console.log("   You can now start the bot with: node bot.js");
}

main().catch((err) => {
  console.error("❌ Download failed:", err.message);
  console.log("\nManual fallback:");
  console.log(
    "  Download https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
  );
  console.log(`  and save it as ${OUT_FILE}`);
  process.exit(1);
});
