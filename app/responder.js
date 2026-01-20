const { getEventHash, getSignature } = require('nostr-tools');
const { getConfig } = require('./config');
const store = require('./store');
const { slugify, formatTimestamp } = require('./utils');

const subscriptions = new Map();
const processingEvents = new Set();

function parseCommand(content) {
  const contentWithoutMentions = content
    .replace(/(^|\s)(nostr:)?npub[0-9a-zA-Z]+/g, '')
    .trim();
  
  const match = contentWithoutMentions.match(/^!(\w+)(?:\s+(.+))?/);
  if (!match) return null;
  
  return {
    command: match[1].toLowerCase(),
    arg: match[2]?.trim()
  };
}

function getThreadTags(event, relayUrl) {
  const eTags = event.tags.filter(t => t[0] === 'e');
  const pTags = event.tags.filter(t => t[0] === 'p');
  
  let resultTags = [];
  let rootEventId = null;
  let rootAuthor = null;
  
  if (eTags.length === 0) {
    rootEventId = event.id;
    rootAuthor = event.pubkey;
    resultTags.push(['e', event.id, relayUrl || '', 'root']);
  } else {
    const rootTag = eTags.find(t => t[3] === 'root');
    
    if (rootTag) {
      rootEventId = rootTag[1];
      resultTags.push(['e', rootEventId, rootTag[2] || '', 'root']);
    } else {
      rootEventId = eTags[0][1];
      resultTags.push(['e', rootEventId, eTags[0][2] || '', 'root']);
    }
    
    resultTags.push(['e', event.id, relayUrl || '', 'reply']);

    if (pTags.length > 0) {
      rootAuthor = pTags[0][1];
    }
  }
  
  const orderedPubkeys = [];
  const seenPubkeys = new Set();
  
  if (rootAuthor && !seenPubkeys.has(rootAuthor)) {
    orderedPubkeys.push(rootAuthor);
    seenPubkeys.add(rootAuthor);
  }
  
  pTags.forEach(tag => {
    const pubkey = tag[1];
    if (pubkey && !seenPubkeys.has(pubkey)) {
      orderedPubkeys.push(pubkey);
      seenPubkeys.add(pubkey);
    }
  });
  
  if (event.pubkey && !seenPubkeys.has(event.pubkey)) {
    orderedPubkeys.push(event.pubkey);
    seenPubkeys.add(event.pubkey);
  }
  
  orderedPubkeys.forEach(pubkey => {
    resultTags.push(['p', pubkey]);
  });
  
  return resultTags;
}

function buildReply(event, content, botPubkey, botPrivkey, nip05, relayUrl) {
  const reply = {
    kind: 1,
    pubkey: botPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ...getThreadTags(event, relayUrl),
      ['client', 'nostrifeed-bot'],
      ['nip05', nip05]
    ],
    content,
  };
  
  reply.id = getEventHash(reply);
  reply.sig = getSignature(reply, botPrivkey);
  
  return reply;
}

const commands = {
  feeds: () => {
    const config = getConfig();
    const feedList = config.feeds
      .map(feed => `• ${feed.name}`)
      .join('\n');
    
    return `📡 Available feeds (${config.feeds.length}):\n\n${feedList}`;
  },

  latest: (arg) => {
    if (!arg) {
      return '❌ Please specify a feed name or category.\nExample: !latest bitcoin-magazine';
    }

    const config = getConfig();
    const category = slugify(arg);
    const feed = config.feeds.find(f => slugify(f.name) === category);
    const items = store.fetchLatestNews(category, 3, feed ? true : false);
    
    if (items.length === 0) {
      return `❌ No news found for "${arg}".\n\nTry !feeds to see available sources.`;
    }
    
    return `📰 Latest news from "${arg}":\n\n${items.join('\n\n')}`;
  },

  categories: () => {
    const categories = store.getCategories();
    
    if (categories.length === 0) {
      return '❌ No categories found yet.';
    }
    
    return `📂 Available categories (${categories.length}):\n\n${categories.map(c => `• #${c}`).join('\n')}`;
  },

  stats: () => {
    const stats = store.getStats();
    const feedStats = store.getFeedStats();
    const topFeeds = Object.entries(feedStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feed, count]) => `• ${feed}: ${count}`)
      .join('\n');

    return [
      '📊 Bot Statistics:\n',
      `• Total published: ${stats.totalPublished}`,
      `• Total responses: ${stats.totalResponded}`,
      `• Stored items: ${stats.totalStored}`,
      `• Last run: ${stats.lastRun ? formatTimestamp(stats.lastRun) : 'Never'}`,
      topFeeds ? `\n🏆 Top Feeds:\n${topFeeds}` : ''
    ].join('\n');
  },

  help: () => {
    return [
      '🤖 NostriFeed Bot Commands:\n',
      '• !feeds — List all RSS feeds I follow',
      '• !latest <name> — Show latest 3 items from a feed or category',
      '  Example: !latest coindesk',
      '• !categories — List all available categories',
      '• !stats — Show bot statistics',
      '• !help — Show this message',
      '\n💡 Mention me with a command to interact!'
    ].join('\n');
  }
};

async function handleCommand(event, botPubkey, botPrivkey, nip05, relayManager, relayUrl) {
  if (event.pubkey === botPubkey || store.wasResponded(event.id)) {
    return;
  }

  const cmd = parseCommand(event.content);
  if (!cmd) return;

  console.log(`📨 Command received: !${cmd.command} from ${event.pubkey.slice(0, 8)}...`);

  let response;
  
  if (commands[cmd.command]) {
    try {
      response = commands[cmd.command](cmd.arg);
    } catch (err) {
      console.error(`❌ Error executing command ${cmd.command}:`, err);
      response = '❌ Sorry, something went wrong processing your command.';
    }
  } else {
    response = `❌ Unknown command: !${cmd.command}\n\nUse !help to see available commands.`;
  }

  const replyEvent = buildReply(event, response, botPubkey, botPrivkey, nip05, relayUrl);
  
  try {
    const { success, results } = await relayManager.publish(replyEvent);
    const successCount = results.filter(r => r.success).length;
    
    if (success && successCount > 0) {
      store.addRespondedEvent(event.id);
      console.log(`✅ Replied to ${event.id.slice(0, 8)}... on ${successCount} relays`);
    } else {
      console.error(`❌ Failed to send reply to ${event.id.slice(0, 8)}...`);
    }
  } catch (err) {
    console.error('❌ Error publishing reply:', err);
  }
}

function respondToMentions(relayManager, botPubkey, botPrivkey, nip05) {
  console.log('👂 Listening for mentions...\n');
  
  const config = getConfig();
  
  for (const relayUrl of config.relays) {
    const relay = relayManager.getRelay(relayUrl);
    if (!relay) continue;

    try {
      const sub = relay.sub([
        {
          kinds: [1],
          '#p': [botPubkey],
          since: Math.floor(Date.now() / 1000)
        }
      ]);

      subscriptions.set(relayUrl, sub);

      sub.on('event', async (event) => {
        if (processingEvents.has(event.id)) {
          console.log(`⏭️  Skipping duplicate event ${event.id.slice(0, 8)}...`);
          return;
        }
        
        processingEvents.add(event.id);
        
        try {
          await handleCommand(event, botPubkey, botPrivkey, nip05, relayManager, relayUrl);
        } catch (err) {
          console.error(`❌ Error handling event ${event.id.slice(0, 8)}:`, err);
        } finally {
          setTimeout(() => {
            processingEvents.delete(event.id);
          }, 10000);
        }
      });

      sub.on('eose', () => {
        console.log(`✅ Subscribed to mentions on ${relayUrl}`);
      });

    } catch (err) {
      console.error(`❌ Error subscribing to ${relayUrl}:`, err.message);
    }
  }
}

function closeAllSubscriptions() {
  for (const [url, sub] of subscriptions) {
    try {
      sub.unsub();
      console.log(`🔌 Unsubscribed from ${url}`);
    } catch (err) {
      console.error(`Error unsubscribing from ${url}:`, err.message);
    }
  }
  subscriptions.clear();
  processingEvents.clear();
}

module.exports = {
  parseCommand,
  respondToMentions,
  closeAllSubscriptions,
  handleCommand,
  commands
};