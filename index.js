// index.js - NostriFeed Bot
require('dotenv').config();
const fs = require('fs');
const Parser = require('rss-parser');
const { relayInit, getEventHash, getSignature, getPublicKey } = require('nostr-tools');

const parser = new Parser();
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const feeds = config.feeds;
const relays = config.relays;

const privateKey = process.env.NOSTR_PRIVATE_KEY;
const pubkey = getPublicKey(privateKey);

async function publishToRelays(event) {
  for (const url of relays) {
    const relay = relayInit(url);
    try {
      await relay.connect();
      let pub = relay.publish(event);
      pub.on('ok', () => console.log(`[✓] Publicado em ${url}`));
      pub.on('failed', reason => console.log(`[X] Falha em ${url}:`, reason));
    } catch (err) {
      console.log(`[X] Erro ao conectar ao relay ${url}:`, err);
    }
  }
}

async function fetchAndPublish() {
  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, 5)) {
        const content = `🗞️ ${item.title}\n${item.link}\nFonte: ${feed.title}`;
        const event = {
          kind: 1,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content,
        };
        event.id = getEventHash(event);
        event.sig = getSignature(event, privateKey);
        await publishToRelays(event);
      }
    } catch (err) {
      console.error(`Erro ao buscar feed ${feedUrl}:`, err);
    }
  }
}

// Executa a cada 30 minutos
fetchAndPublish();
setInterval(fetchAndPublish, 30 * 60 * 1000);