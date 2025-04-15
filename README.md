# 🗞️ NostriFeed Bot

![Node.js](https://img.shields.io/badge/node-%3E=18.x-green)
![npm](https://img.shields.io/badge/npm-%3E=9.x-blue)
![License](https://img.shields.io/github/license/drexduarte/nostrifeed-bot)
![Last Commit](https://img.shields.io/github/last-commit/drexduarte/nostrifeed-bot)
![coverage](https://img.shields.io/badge/coverage-98%25-brightgreen)
![Issues](https://img.shields.io/github/issues/drexduarte/nostrifeed-bot)
![Stars](https://img.shields.io/github/stars/drexduarte/nostrifeed-bot?style=social)

> 🚀 **NostriFeed Bot** is your bridge between traditional news and the decentralized Nostr network. It fetches RSS feeds and posts the latest headlines to your favorite relays — automatically, intelligently, and with filters to keep things relevant.

## Features

- 🌐 Supports multiple RSS feeds and relays
- ✍️ Publishes news headlines to Nostr as kind:1 events
- 🔎 Filters posts by category or title keywords
- 🧠 Avoids duplicate posts using a persistent local store
- ⚙️ Fully configurable via `config.json`
- 🔐 Secure key management via `.env`

---

## Setup

1. Clone the repo:

```bash
git clone https://github.com/drexduarte/nostrifeed-bot.git
cd nostrifeed-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your Nostr private key and your NIP-05 address (check the `.env.example` file):

```env
NOSTR_PRIVATE_KEY=your_hex_private_key_here
NIP05_ADDRESS=your@domain.com
```

4. Edit `config.json` to set your desired RSS feeds, relays, filters, and other preferences.

5. Start the bot:

```bash
node index.js
```

The bot will check RSS feeds and publish the latest news to Nostr every 30 minutes.

---

## 🔐 Generate Nostr Keys (nsec/npub)

To generate a new Nostr key pair (`nsec` and `npub`), you can run the script provided in the project:

```bash
node app/generate-key.js
```

This will output both your private and public keys in raw hex and NIP-19 encoded formats:

- 🔑 Private key (`nsec...`)
- 🪪 Public key (`npub...`)

> ⚠️ **Important:** Keep your `nsec` key safe and never share it publicly.

---

## Example Output

Here’s what a published Nostr event might look like:

```
📰 *BBC News*  
"Climate change: World is 'failing to tackle crisis', UN warns"  
🔗 https://www.bbc.co.uk/news/science-environment-123456
Source: Business News #Newstr
```

---

## 📟 Commands via Nostr

Once mentioned in a note, the bot supports the following commands:

| Command                | Description                                  |
|------------------------|----------------------------------------------|
| `!feeds`               | List available feeds                         |
| `!latest <category>`   | Show latest 3 links from a category          |
| `!categories`          | List known categories from published items   |
| `!help`                | Show command help                            |

---

## 📌 Version

Current version: **1.0.0** — First stable release 🚀

---

## Contributing

Contributions are welcome! Feel free to fork this repo, create a new branch, and submit a pull request. If you find any bugs or have suggestions for improvements, open an issue to discuss.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

# Next Steps

Here are a few ideas for future improvements:

- 🔍 Support full-text content extraction from articles
- 🧵 Publish threaded event summaries grouped by topic
- 🔗 Add NIP-05 verified profile management and updates
- 🌍 Improve support for multilingual feeds and summaries
- 🗂️ Add tagging based on article topics or sentiment analysis
- 📊 Dashboard for monitoring bot activity and stats

---

Built with 💜 using [nostr-tools](https://github.com/nostr-protocol/nostr-tools).