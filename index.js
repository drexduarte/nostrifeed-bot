require('dotenv').config();
const Parser = require('rss-parser');
const { getPublicKey, getEventHash, getSignature } = require('nostr-tools');

const { getConfig, watchConfig } = require('./app/config');
const { shouldFilterItem } = require('./app/filters');
const { delay, normalizeLink } = require('./app/utils');
const store = require('./app/store');
const { publishToRelays } = require('./app/publisher');
const { respondToMentions } = require('./app/responder');

const parser = new Parser();
const BOT_PRIVATEKEY = process.env.NOSTR_PRIVATE_KEY;
const NIP05_ADDRESS = process.env.NIP05_ADDRESS;
const BOT_PUBLICKEY = getPublicKey(BOT_PRIVATEKEY);

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

  for (const feed of feeds) {
    try {
      const feedContent = await parser.parseURL(feed.url);
      for (const item of feedContent.items.slice(0, itemsPerFeed)) {
        const normalizedLink = normalizeLink(item.link);

        if (publishedLinks.includes(normalizedLink)) {
          console.log(`🔁 Already published: ${item.link}`);
          continue;
        }

        if (shouldFilterItem(item, filters)) {
          console.log(`⛔ Skipped by filter: ${item.title}`);
          continue;
        }

        const content = `🗞️ ${item.title}

${item.link}

Source: ${feedContent.title} #Newstr`;
        const unsignedEvent = {
          kind: 1,
          pubkey: BOT_PUBLICKEY,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['client', 'nostrifeed-bot'], ['nip05', NIP05_ADDRESS]],
          content,
        };

        unsignedEvent.id = getEventHash(unsignedEvent);
        unsignedEvent.sig = getSignature(unsignedEvent, BOT_PRIVATEKEY);

        await publishToRelays(unsignedEvent, relays);

        let category = '';
        if (item.categories && item.categories.length > 0) {
          const first = item.categories[0];
          category = typeof first === 'string'
            ? first
            : (first.value || first._ || '');
        }
        store.addPublishedLink(normalizedLink, maxStoredLinks, category.trim());

        await delay(5000);
      }
    } catch (err) {
      console.error(`Error while fetching feed ${feed.url}:`, err);
    }
  }
}

respondToMentions();

// Runs every minute after the previous execution finishes
async function loop() {
  try {
    await fetchAndPublish();
  } catch (err) {
    console.error("Error in publishing loop:", err);
  } finally {
    setTimeout(loop, 60 * 1000);
  }
}

loop();