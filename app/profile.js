const { getPublicKey, getEventHash, getSignature, relayInit, nip19 } = require('nostr-tools');
const fetch = require('node-fetch');
require('dotenv').config();

const BOT_PRIVATEKEY = process.env.NOSTR_PRIVATE_KEY;
const NIP05_ADDRESS = process.env.NIP05_ADDRESS;
const BOT_PUBLICKEY = getPublicKey(BOT_PRIVATEKEY);

const config = require('./config').getConfig();

async function isNip05Verified(nip05, pubkey) {
  try {
    const [name, domain] = nip05.split('@');
    const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const expectedNpub = nip19.npubEncode(pubkey);
    return data?.names?.[name] === pubkey || data?.names?.[name] === expectedNpub;
  } catch (err) {
    console.error(`⚠️ Failed to verify NIP-05: ${err.message}`);
    return false;
  }
}

async function publishProfile() {
  if (await isNip05Verified(NIP05_ADDRESS, BOT_PUBLICKEY)) {
    console.log('✅ NIP-05 verification successful.');

    const profileEvent = {
      kind: 0,
      pubkey: BOT_PUBLICKEY,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: config.botName,
        about: config.botDescription,
        nip05: NIP05_ADDRESS,
      }),
    };
  
    profileEvent.id = getEventHash(profileEvent);
    profileEvent.sig = getSignature(profileEvent, BOT_PRIVATEKEY);
  
    for (const relayUrl of config.relays) {
      const relay = relayInit(relayUrl);
      try {
        await relay.connect();
        await relay.publish(profileEvent);
        console.log(`✅ NIP-05 profile published to ${relayUrl}`);
        relay.close();
      } catch (err) {
        console.error(`❌ Failed to publish profile to ${relayUrl}: ${err?.message || err}`);
      }
    }
  } else {
    console.warn('❌ NIP-05 verification failed. Check your DNS and nostr.json setup.');
  }
}

module.exports = { publishProfile };