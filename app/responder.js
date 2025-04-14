const { relayInit, getPublicKey, getEventHash, getSignature, nip19 } = require('nostr-tools');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const store = require('./store');
const config = require('./config').getConfig();

const RELAYS = config.relays;
const privateKey = process.env.NOSTR_PRIVATE_KEY;
const publicKey = getPublicKey(privateKey);

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
    pubkey: publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', event.id],
      ['p', event.pubkey],
    ],
    content,
  };
  reply.id = getEventHash(reply);
  reply.sig = getSignature(reply, privateKey);
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
          '#p': [publicKey], // menção direta via tag
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
        } else {
          response = `🤖 Oops! I didn’t understand that.\nYou can use:\n\n• !feeds — list all available feeds\n• !latest <category> — get recent posts from a category`;
        }

        const replyEvent = buildReply(event, response);
        relay.publish(replyEvent);
        console.log(`Replied to ${event.pubkey}.`);
      });
    } catch (err) {
      console.error(`Error connecting to relay ${relayUrl}:`, err.message || err);
    }
  }
}

module.exports = { parseCommand, respondToMentions };