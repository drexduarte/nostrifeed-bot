require('dotenv').config();
const Parser = require('rss-parser');
const { getPublicKey, getEventHash, getSignature } = require('nostr-tools');

const { getConfig, watchConfig } = require('./app/config');
const { shouldFilterItem } = require('./app/filters');
const { 
  delay,
  delayWithJitter,
  normalizeLink, 
  slugify, 
  sanitizeHtml, 
  retryWithBackoff 
} = require('./app/utils');
const store = require('./app/store');
const RelayManager = require('./app/relay-manager');
const { respondToMentions } = require('./app/responder');

const parser = new Parser({
  requestOptions: {
    headers: {
      'User-Agent': 'NostriFeedBot/2.0 (+https://github.com/drexduarte/nostrifeed-bot)',
      'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
    },
    timeout: 10000
  },
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure']
  }
});

const BOT_PRIVATEKEY = process.env.NOSTR_PRIVATE_KEY;
const NIP05_ADDRESS = process.env.NIP05_ADDRESS;
const BOT_PUBLICKEY = getPublicKey(BOT_PRIVATEKEY);

let relayManager;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

watchConfig(() => {
  console.log('🔄 Configuration reloaded, reconnecting to relays...');
  initializeRelays();
});

async function initializeRelays() {
  const config = getConfig();
  
  if (relayManager) {
    await relayManager.closeAll();
  }
  
  relayManager = new RelayManager(config.relays, {
    reconnectDelay: config.relayOptions?.reconnectDelay || 5000,
    maxRetries: config.relayOptions?.maxRetries || 3,
    timeout: config.relayOptions?.timeout || 10000,
    publishTimeout: config.relayOptions?.publishTimeout || 5000
  });
  
  await relayManager.connectAll();
}

async function fetchFeed(feedUrl) {
  return retryWithBackoff(
    () => parser.parseURL(feedUrl),
    { maxRetries: 3, initialDelay: 2000 }
  );
}

async function createNostrEvent(content) {
  const event = {
    kind: 1,
    pubkey: BOT_PUBLICKEY,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['client', 'nostrifeed-bot'],
      ['nip05', NIP05_ADDRESS]
    ],
    content,
  };

  event.id = getEventHash(event);
  event.sig = getSignature(event, BOT_PRIVATEKEY);
  
  return event;
}

async function publishItem(item, feed, filters) {
  const normalizedLink = normalizeLink(item.link);
  const itemTitle = sanitizeHtml(item.title || '');

  if (store.wasPublished(normalizedLink, itemTitle)) {
    console.log(`📌 Already published: ${itemTitle}`);
    return false;
  }

  if (shouldFilterItem(item, filters)) {
    console.log(`⛔ Filtered: ${itemTitle}`);
    return false;
  }

  let category = '';
  if (item.categories && item.categories.length > 0) {
    const first = item.categories[0];
    category = typeof first === 'string'
      ? first
      : (first.value || first._ || '');
  }

  const content = [
    `📰 ${feed.name}`,
    itemTitle,
    normalizedLink,
    `#news` + (category ? ` #${slugify(category, { hashtagFriendly: true })}` : '')
  ].join('\n\n');

  try {
    const event = await createNostrEvent(content);
    const publishResult = await relayManager.publish(event);  
    if (publishResult.success) {
      const successCount = publishResult.results.filter(r => r.success).length;
      store.addPublishedLink(
        normalizedLink,
        getConfig().maxStoredLinks || 500,
        category.trim(),
        slugify(feed.name),
        itemTitle
      );
      console.log(`✅ Published "${itemTitle}" to ${successCount}/${publishResult.results.length} relays`);
      return true;
    } else {
      console.error(`❌ Failed to publish to any relay: ${itemTitle}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error publishing item:`, err.message);
    return false;
  }
}

async function fetchAndPublish() {
  const config = getConfig();
  const startTime = Date.now();
  
  console.log('\n🚀 Starting feed fetch cycle...');

  try {
    let totalPublished = 0;
    let totalProcessed = 0;

    for (const feed of config.feeds) {
      if (!feed.enabled) {
        console.log(`⏭️  Skipping disabled feed: ${feed.name}`);
        continue;
      }

      try {
        console.log(`\n📡 Fetching: ${feed.name}`);
        const feedContent = await fetchFeed(feed.url);
        const items = feedContent.items.slice(0, config.itemsPerFeed || 5);
        for (const item of items) {
          totalProcessed++;
          const published = await publishItem(item, feed, config.filters || {});
          if (published) {
            totalPublished++;
            await delayWithJitter(config.rateLimit?.delayBetweenPosts || 5000,
              config.rateLimit?.jitterPercent || 30);
          }
        }
        await delayWithJitter(config.rateLimit?.delayBetweenFeeds || 2000,
          config.rateLimit?.jitterPercent || 30);
      } catch (err) {
        console.error(`❌ Error fetching feed ${feed.name}:`, err.message);
        consecutiveErrors++;
      }
    }

    if (totalPublished > 0) {
      consecutiveErrors = 0;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Cycle complete: ${totalPublished}/${totalProcessed} published in ${duration}s`);
    console.log(`📊 Stats: ${JSON.stringify(store.getStats(), null, 2)}`);

  } catch (err) {
    console.error('❌ Critical error in fetch cycle:', err);
    consecutiveErrors++;
    
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`🆘 Too many consecutive errors (${consecutiveErrors}). Attempting full restart...`);
      await restart();
    }
  }
}

async function restart() {
  console.log('🔄 Restarting bot...');
  consecutiveErrors = 0;
  
  try {
    await initializeRelays();
    console.log('✅ Bot restarted successfully');
  } catch (err) {
    console.error('❌ Failed to restart:', err);
  }
}

async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  if (relayManager) {
    await relayManager.closeAll();
  }
  
  console.log('👋 Goodbye!');
  process.exit(0);
}

// Handlers para sinais de término
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handler para erros não capturados
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err);
  consecutiveErrors++;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  consecutiveErrors++;
});

async function scheduledLoop() {
  const config = getConfig();
  const intervalMs = (config.publishInterval || 180) * 1000;
  
  try {
    await fetchAndPublish();
  } catch (err) {
    console.error('❌ Error in scheduled loop:', err);
  }

  console.log(`⏰ Next cycle in ${config.publishInterval}s...`);
  setTimeout(scheduledLoop, intervalMs);
}

async function init() {
  console.log('🤖 NostriFeed Bot v2.0');
  console.log(`🆔 Public Key: ${BOT_PUBLICKEY}`);
  console.log(`📧 NIP-05: ${NIP05_ADDRESS}\n`);

  await initializeRelays();
  respondToMentions(relayManager, BOT_PUBLICKEY, BOT_PRIVATEKEY, NIP05_ADDRESS);

  scheduledLoop();
}

init().catch(err => {
  console.error('💥 Fatal error during initialization:', err);
  process.exit(1);
});