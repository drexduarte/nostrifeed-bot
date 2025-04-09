require('dotenv').config();
const fs = require('fs');
const Parser = require('rss-parser');
const { relayInit, getEventHash, getPublicKey, getSignature } = require('nostr-tools');

const parser = new Parser();
let config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Recarregar config.json dinamicamente quando for modificado
fs.watchFile('config.json', () => {
  try {
    const newConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    Object.assign(config, newConfig);
    console.log('🔄 config.json recarregado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao recarregar config.json:', err);
  }
});

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
  if (publishedLinks.links.length > (config.maxPublishedLinks || 500)) {
    publishedLinks.links = publishedLinks.links.slice(-(config.maxPublishedLinks || 500));
  }
  fs.writeFileSync(publishedFile, JSON.stringify(publishedLinks, null, 2));
}

function normalizeLink(link) {
  try {
    const url = new URL(link);
    url.search = '';
    return url.toString();
  } catch {
    return link;
  }
}

function shouldFilterItem(item) {
  const title = item.title.toLowerCase();
  const categories = (item.categories || [])
    .filter(c => typeof c === 'string')
    .map(c => c.toLowerCase());

  const filters = config.filters || {};
  if (filters.exclude_keywords) {
    for (const keyword of filters.exclude_keywords) {
      const kw = keyword.toLowerCase();
      if (title.includes(kw)) return true;
      if (categories.some(cat => cat.includes(kw))) return true;
    }
  }

  return false;
}

async function publishToRelays(event) {
  for (const url of config.relays) {
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
  for (const feedUrl of config.feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, config.itemsPerFeed || 5)) {
        const normalizedLink = normalizeLink(item.link);

        if (publishedLinks.links.includes(normalizedLink)) {
          console.log(`🔁 Já publicada: ${item.link}`);
          continue;
        }

        if (shouldFilterItem(item)) {
          console.log(`⛔ Ignorada por filtro: ${item.title}`);
          continue;
        }

        const content = `🗞️ ${item.title}
${item.link}
Fonte: ${feed.title}`;
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

        publishedLinks.links.push(normalizedLink);
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