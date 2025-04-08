const Parser = require('rss-parser');
const { relayInit, getEventHash, getSignature, validateEvent } = require('nostr-tools');
const fetch = require('node-fetch');
require('dotenv').config();

const parser = new Parser();

const PRIVATE_KEY = process.env.NOSTR_PRIVATE_KEY;
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.fmt.wiz.biz'
];

const FEEDS = [
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    source: 'NYTimes'
  },
  {
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    source: 'BBC'
  }
];

const skToHex = (hex) => Buffer.from(hex, 'hex');
const getPublicKey = require('nostr-tools').getPublicKey;
const sk = skToHex(PRIVATE_KEY);
const pubkey = getPublicKey(PRIVATE_KEY);

async function publishToNostr(event) {
  for (const url of RELAYS) {
    const relay = relayInit(url);
    await relay.connect();

    relay.on('connect', async () => {
      const pub = relay.publish(event);
      pub.on('ok', () => {
        console.log(`Published to ${url}`);
        relay.close();
      });
      pub.on('failed', (reason) => {
        console.error(`Failed to publish to ${url}:`, reason);
        relay.close();
      });
    });
  }
}

async function fetchAndPublish() {
  for (const feed of FEEDS) {
    const data = await parser.parseURL(feed.url);
    for (const item of data.items.slice(0, 3)) { // pega as 3 últimas notícias
      const content = `🗞️ *${item.title}*\n${item.link}\nFonte: ${feed.source}`;
      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['source', feed.source]],
        content,
        pubkey,
      };
      event.id = getEventHash(event);
      event.sig = getSignature(event, PRIVATE_KEY);

      if (validateEvent(event)) {
        await publishToNostr(event);
      } else {
        console.error('Evento inválido:', event);
      }
    }
  }
}

// Roda a cada X minutos
fetchAndPublish();
setInterval(fetchAndPublish, 1000 * 60 * 30); // a cada 30 min
