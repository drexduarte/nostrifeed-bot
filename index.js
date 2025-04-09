require('dotenv').config();
const Parser = require('rss-parser');
const { getPublicKey, getEventHash, getSignature } = require('nostr-tools');

const { getConfig, watchConfig } = require('./app/config');
const { shouldFilterItem } = require('./app/filters');
const { delay, normalizeLink } = require('./app/utils');
const store = require('./app/store');
const { publishToRelays } = require('./app/publisher');

const parser = new Parser();
const privateKey = process.env.NOSTR_PRIVATE_KEY;
const pubkey = getPublicKey(privateKey);

// Dynamically reload config file on changes
watchConfig();

async function fetchAndPublish() {
  const config = getConfig();
  const feeds = config.feeds;
  const relays = config.relays;
  const itemsPerFeed = config.itemsPerFeed || 5;
  const maxStoredLinks = config.maxStoredLinks || 500;
  const filters = config.filters || {};
  const publishedLinks = store.getPublishedLinks().map(entry => entry.url);

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

        const content = `🗞️ ${item.title}

${item.link}

Source: ${feed.title} #Newstr`;
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

        let category = '';
        if (item.categories && item.categories.length > 0) {
          const first = item.categories[0];
          category = typeof first === 'string'
            ? first
            : (first.value || first._ || '');
        }
        store.addPublishedLink(normalizedLink, maxStoredLinks, category);

        await delay(2000);
      }
    } catch (err) {
      console.error(`Erro ao buscar feed ${feedUrl}:`, err);
    }
  }
}

// Runs every minute after the previous execution finishes
async function loop() {
  await fetchAndPublish();
  setTimeout(loop, 60 * 1000);
}

loop();