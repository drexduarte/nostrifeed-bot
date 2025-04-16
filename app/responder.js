const { relayInit, getPublicKey, getEventHash, getSignature, nip19 } = require('nostr-tools');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const store = require('./store');
const config = require('./config').getConfig();

const RELAYS = config.relays;
const BOT_PRIVATEKEY = process.env.NOSTR_PRIVATE_KEY;
const NIP05_ADDRESS = process.env.NIP05_ADDRESS;
const BOT_PUBLICKEY = getPublicKey(BOT_PRIVATEKEY);

const respondedEvents = new Set();

function parseCommand(content) {
  const contentWithoutMentions = content.replace(/(^|\s)(nostr:)?npub[0-9a-zA-Z]+/g, '').trim();
  const match = contentWithoutMentions.match(/^!(\w+)(?:\s+(.+))?/);
  if (!match) return null;
  return { command: match[1], arg: match[2] };
}

function buildReply(event, content) {
  const reply = {
    kind: 1,
    pubkey: BOT_PUBLICKEY,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', event.id],
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
  for (const relayUrl of RELAYS) {
    const relay = relayInit(relayUrl);

    try {
      await relay.connect();

      const sub = relay.sub([
        {
          kinds: [1],
          '#p': [BOT_PUBLICKEY], // menção direta via tag
          since: Math.floor(Date.now() / 1000) - 60, // últimos 60 segundos
        },
      ]);

      sub.on('event', async (event) => {
        if (respondedEvents.has(event.id)) return; // já respondido
        respondedEvents.add(event.id);

        const cmd = parseCommand(event.content);
        if (!cmd) return;

        let response;
        if (cmd.command === 'feeds') {
          response = `📡 Available feeds:\n\n${config.feeds.map(feed => `• ${feed.name}`).join('\n')}`;
        } else if (cmd.command === 'latest' && cmd.arg) {
          const category = cmd.arg.trim();
          const items = store.fetchLatestNews(category, 3);
          if (items.length === 0) {
            response = `❌ Sorry, I couldn’t find any news for the category "${category}".`;
          } else {
            response = `📰 Latest news related to "${category}":\n` + items.map(i => `• ${i}`).join('\n');
          }
        } 
        else if (cmd.command === 'categories') {
          const categories = [...new Set(store.getPublishedLinks().map(link => link.category).filter(Boolean))];
          if (categories.length === 0) {
            response = `❌ Sorry, I couldn’t find any categories.`;
          } else {
            response = `📂 Recent categories:\n` + categories.map(c => `• ${c}`).join('\n');
          }
        }
        else if (cmd.command === 'help') {
          response = `🤖 I can help you with the following commands:\n\n` +
            `• !feeds — list all available feeds\n` +
            `• !latest <category> — get recent posts from a category\n` +
            `• !categories — list all recent categories (last 500 news)`;
        }
        else {
          response = `🤖 Oops! I didn’t understand that.\n\nYou can use !help to check available commands.`;
        }

        const replyEvent = buildReply(event, response);
        relay.publish(replyEvent)
          .then(() => console.log(`✅ Successfully replied to ${event.id} on ${relayUrl}`))
          .catch(err => console.log(`❌ Failed to reply to ${event.id} on ${relayUrl}: ${err?.message || err}`)); 
      });
    } catch (err) {
      console.error(`Error connecting to relay ${relayUrl}:`, err.message || err);
    }
  }
}

module.exports = { parseCommand, respondToMentions };