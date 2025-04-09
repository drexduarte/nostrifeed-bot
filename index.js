require('dotenv').config();
const Parser = require('rss-parser');
const { getPublicKey, getEventHash, getSignature } = require('nostr-tools');

const { getConfig, watchConfig } = require('./config');
const { shouldFilterItem } = require('./filters');
const { delay, normalizeLink } = require('./utils');
const { getPublishedLinks, addPublishedLink } = require('./store');
const { publishToRelays } = require('./publisher');

const parser = new Parser();
const privateKey = process.env.NOSTR_PRIVATE_KEY;
const pubkey = getPublicKey(privateKey);

// Recarrega config dinamicamente
watchConfig();

async function fetchAndPublish() {
  const config = getConfig();
  const feeds = config.feeds;
  const relays = config.relays;
  const itemsPerFeed = config.itemsPerFeed || 5;
  const maxStoredLinks = config.maxStoredLinks || 500;
  const filters = config.filters || {};
  const publishedLinks = getPublishedLinks();

  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, itemsPerFeed)) {
        const normalizedLink = normalizeLink(item.link);

        if (publishedLinks.includes(normalizedLink)) {
          console.log(`🔁 Já publicada: ${item.link}`);
          continue;
        }

        if (shouldFilterItem(item, filters)) {
          console.log(`⛔ Ignorada por filtro: ${item.title}`);
          continue;
        }

        const content = `🗞️ ${item.title}\n${item.link}\nFonte: ${feed.title}`;
        const unsignedEvent = {
          kind: 1,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['client', 'nostrifeed-bot'], ['nip05', 'nostrifeedbot@nostrcheck.me']],
          content,
        };

        unsignedEvent.id = getEventHash(unsignedEvent);
        unsignedEvent.sig = getSignature(unsignedEvent, privateKey);

        await publishToRelays(unsignedEvent, relays);
        addPublishedLink(normalizedLink, maxStoredLinks);
        await delay(2000);
      }
    } catch (err) {
      console.error(`Erro ao buscar feed ${feedUrl}:`, err);
    }
  }
}

// Executa a cada minuto após o término da execução anterior
async function loop() {
  await fetchAndPublish();
  setTimeout(loop, 60 * 1000);
}

loop();