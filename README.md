# 📝 Word Counter Bot

A Discord bot inspired by counting bots — but instead of numbers, players collectively build a library of **unique English words**. Every word can only be said once, forever.

---

## ✨ How It Works

1. An admin runs `/wordcounter` in a channel to start the game.
2. Players type **a single valid English word** in that channel.
3. If the word is new → it gets logged with the author's name.
4. If the word was already said → the bot **silently deletes** it and notifies the player who it belongs to.
5. If someone types gibberish → silently deleted + warning.
6. **No consecutive words** — you must wait for someone else to go before you go again.
7. If someone **deletes their word** → the bot announces it publicly so everyone knows it's back.

---

## 🛠 Setup

### Ignore this if forking this repo for railway.
1-1. Only create a bot from [Discord Developer Portal](https://discord.com/developers/applications) copy the token. Host it on railway.
1-2. go to variables on your project then use this variable  `DISCORD_TOKEN`  while the value will be your application's token.
1-3. skip other steps.

### 1. Prerequisites

- **Node.js 18+** — https://nodejs.org
- A Discord bot token — https://discord.com/developers/applications

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the bot

```bash
cp .env.example .env
```

Edit `.env` and set your bot token:

```
DISCORD_TOKEN=your_bot_token_here
```

### 4. Download the word list

```bash
node download-words.js
```

This downloads **~466,000 English words** (including rare/archaic ones) from:

> 🔗 **https://github.com/dwyl/english-words**
>
> It's the most comprehensive free English word list available — it includes standard dictionary words, archaic/rare words, and technical terms. It uses the `words_alpha.txt` file (letters only, no numbers or symbols).

The script also injects a curated set of **Gen Z / internet slang** words (slay, rizz, bussin, gyatt, delulu, sigma, goated, etc.) that aren't in traditional dictionaries.

**Want even more words or custom slang?** Just append them to `data/words.txt`, one word per line.

### 5. Discord bot settings

In the [Discord Developer Portal](https://discord.com/developers/applications):

- **Privileged Gateway Intents:** Enable `Message Content Intent` and `Server Members Intent`
- **Bot Permissions:** `Send Messages`, `Read Message History`, `Manage Messages`, `Read Messages/View Channels`
- **OAuth2 Scopes:** `bot`, `applications.commands`

Invite URL template:
```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot+applications.commands&permissions=76800
```

### 6. Run the bot

```bash
node bot.js
```

---

## 📋 Slash Commands

| Command | Who | Visible to | Description |
|---|---|---|---|
| `/wordcounter` | Admin | Everyone | Start the game in the current channel |
| `/wordcounter-stop` | Admin | Everyone | Stop the game |
| `/lookup <word>` | Anyone | Only you | Check if a word has been claimed |
| `/stats` | Anyone | Only you | Leaderboard of top contributors |
| `/recent` | Anyone | Only you | The 10 most recently said words |
| `/wordcount` | Anyone | Only you | Total unique words said so far |

---

## 🗄 Database

Uses **SQLite** via `better-sqlite3` (no separate DB server needed). The database file lives at `data/wordbot.db` and is created automatically on first run.

Tables:
- `config` — which channel the game is active in per guild
- `used_words` — every claimed word with author info and timestamp
- `last_writer` — tracks who spoke last (anti-spam)

---

## 💡 Tips

- **Want to add custom slang?** Add words to `data/words.txt` one per line and restart the bot.
- **Running 24/7?** Use [PM2](https://pm2.keymetrics.io/): `pm2 start bot.js --name wordbot`
- **Multiple servers?** The bot handles multiple guilds automatically — each gets its own word database.

---

## 📦 Word List Source

The best free comprehensive English word list:

**https://github.com/dwyl/english-words** — `words_alpha.txt`
- 466,544 English words
- Letters only (a-z)
- Includes rare, archaic, technical, and regional words
- MIT licensed

For extra slang coverage, supplement with:
- https://github.com/nicholasgasior/NextDictionary (informal)
- Manually curate your own `data/slang.txt` and concatenate it into `words.txt`
