require('dotenv').config();
const fs = require('fs');
const Parser = require('rss-parser');
const { relayInit, getEventHash, getPublicKey, getSignature } = require('nostr-tools');

const parser = new Parser();
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const feeds = config.feeds;
const relays = config.relays;
const itemsPerFeed = config.itemsPerFeed || 5;
const maxPublishedLinks = config.maxPublishedLinks || 500;

const publishedFile = 'published.json';
let publishedLinks = { links: [] };
if (fs.existsSync(publishedFile)) {
  publishedLinks = JSON.parse(fs.readFileSync(publishedFile, 'utf-8'));
}

const privateKey = process.env.NOSTR_PRIVATE_KEY;
const pubkey = getPublicKey(privateKey);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function savePublishedLinks() {
  if (publishedLinks.links.length > maxPublishedLinks) {
    publishedLinks.links = publishedLinks.links.slice(-maxPublishedLinks);
  }
  fs.writeFileSync(publishedFile, JSON.stringify(publishedLinks, null, 2));
}

async function publishToRelays(event) {
  for (const url of relays) {
    const relay = relayInit(url);

    relay.on('notice', msg => {
      console.log(`⚠️ Aviso de ${url}: ${msg}`);
    });

    try {
      await relay.connect();

      const pub = relay.publish(event);

      pub.then(() => {
        console.log(`✅ Sucesso ao publicar em ${url}`);
      }).catch(err => {
        console.log(`❌ Falha ao publicar em ${url}: ${err?.message || err}`);
      });
    } catch (err) {
      console.log(`🛑 Erro ao publicar em ${url}:`, err?.message || err);
    } finally {
      setTimeout(() => relay.close(), 3000);
    }
  }
}

async function fetchAndPublish() {
  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, itemsPerFeed)) {
        if (publishedLinks.links.includes(item.link)) {
          console.log(`🔁 Já publicada: ${item.link}`);
          continue;
        }

        const content = `🗞️ ${item.title}\n${item.link}\nSource: ${feed.title}`;
        const unsignedEvent = {
          kind: 1,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['client', 'nostrifeed-bot'], ['nip05', 'nostrifeedbot@nostrcheck.me']],
          content,
        };
        unsignedEvent.id = getEventHash(unsignedEvent);
        unsignedEvent.sig = getSignature(unsignedEvent, privateKey);
        await publishToRelays(unsignedEvent);

        publishedLinks.links.push(item.link);
        savePublishedLinks();

        await delay(2000); // Aguarda 2 segundos entre as publicações
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