const { relayInit, getPublicKey, getEventHash, getSignature } = require('nostr-tools');
const { getConfig } = require('./config');
require('dotenv').config();

const store = require('./store');
const { slugify } = require('./utils');

const BOT_PRIVATEKEY = process.env.NOSTR_PRIVATE_KEY;
const NIP05_ADDRESS = process.env.NIP05_ADDRESS;
const BOT_PUBLICKEY = getPublicKey(BOT_PRIVATEKEY);

function parseCommand(content) {
  const contentWithoutMentions = content.replace(/(^|\s)(nostr:)?npub[0-9a-zA-Z]+/g, '').trim();
  const match = contentWithoutMentions.match(/^!(\w+)(?:\s+(.+))?/);
  if (!match) return null;
  return { command: match[1], arg: match[2] };
}

function getThreadTags(event) {
  const eTags = event.tags.filter(t => t[0] === 'e');
  if (eTags.length === 0) {
    return [['e', event.id, '', 'root']];
  }
  const root = eTags.find(t => t[3] === 'root') || eTags[0];
  const reply = eTags.find(t => t[3] === 'reply') || eTags[eTags.length - 1];
  return [
    ['e', root[1], '', 'root'],
    ['e', reply[1], '', 'reply'],
  ];
}

function buildReply(event, content) {
  const reply = {
    kind: 1,
    pubkey: BOT_PUBLICKEY,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ...getThreadTags(event),
      ['p', event.pubkey],
      ['client', 'nostrifeed-bot'],
      ['nip05', NIP05_ADDRESS]
    ],
    content,
  };
  reply.id = getEventHash(reply);
  reply.sig = getSignature(reply, BOT_PRIVATEKEY);
  return reply;
}

async function respondToMentions() {
  const config = getConfig();
  const relays = config.relays;
  for (const relayUrl of relays) {
    const relay = relayInit(relayUrl);

    try {
      await relay.connect();

      const sub = relay.sub([
        {
          kinds: [1],
          '#p': [BOT_PUBLICKEY], // menção direta via tag
          since: Math.floor(Date.now() / 1000) - 3600, // última hora antes do bot iniciar
        },
      ]);

      sub.on('event', async (event) => {
        if (store.wasResponded(event.id) || event.pubkey === BOT_PUBLICKEY) return; // já respondido ou é o próprio bot
        
        const cmd = parseCommand(event.content);
        if (!cmd) return;

        let response;
        if (cmd.command === 'feeds') {
          response = `📡 Available feeds:\n\n${config.feeds.map(feed => `• ${feed.name}`).join('\n')}`;
        } else if (cmd.command === 'latest' && cmd.arg) {
          const category = slugify(cmd.arg);
          const feed = config.feeds.find(f => slugify(f.name) === category);
          const items = store.fetchLatestNews(category, 3, feed ? true : false);
          if (items.length === 0) {
            response = `❌ Sorry, I couldn’t find any news for the category "${cmd.arg}".`;
          } else {
            response = `📰 Latest news related to "${cmd.arg}":\n\n` + items.map(i => `• ${i}`).join('\n');
          }
        }
        else if (cmd.command === 'categories') {
          const categories = [...new Set(store.getPublishedLinks().map(link => link.category).filter(Boolean))];
          if (categories.length === 0) {
            response = `❌ Sorry, I couldn’t find any categories.`;
          } else {
            response = `📂 Recent categories:\n\n` + categories.map(c => `• ${c}`).join('\n');
          }
        }
        else if (cmd.command === 'help') {
          response = [
            '🤖 Available commands:\n',
            '• !feeds — List all RSS feeds the bot is currently following.',
            '• !latest <feed name> — Show the latest 3 headlines from a specific feed.',
            '   ⤷ Use the feed name exactly as shown in !feeds (spaces become dashes).',
            '• !latest <category> — Show the latest 3 headlines from a specific category.',
            '• !categories — List categories seen in recent posts.',
            '• !help — Show this message.'
          ].join('\n');
        }
        else {
          response = `🤖 Oops! I didn’t understand that.\n\nYou can use !help to check available commands.`;
        }

        const replyEvent = buildReply(event, response);
        relay.publish(replyEvent)
          .then(() => {
            console.log(`✅ Successfully replied to ${event.id} on ${relayUrl}`)
            store.addRespondedEvent(event.id);
          })
          .catch(err => console.log(`❌ Failed to reply to ${event.id} on ${relayUrl}: ${err?.message || err}`));
      });
    } catch (err) {
      console.error(`Error connecting to relay ${relayUrl}: ${err?.message || err}`);
    }
  }
}

module.exports = { parseCommand, respondToMentions };