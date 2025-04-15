const { relayInit } = require('nostr-tools');

async function publishToRelays(event, relays) {
  for (const url of relays) {
    const relay = relayInit(url);

    relay.on('notice', msg => {
      console.log(`⚠️ Notice from ${url}: ${msg}`);
    });

    try {
      await relay.connect();
      const pub = relay.publish(event);
      pub.then(() => console.log(`✅ Successfully published to ${url}`))
         .catch(err => console.log(`❌ Failed to publish to ${url}: ${err?.message || err}`));
    } catch (err) {
      console.log(`🛑 Error publishing to ${url}:`, err?.message || err);
    } finally {
      setTimeout(() => relay.close(), 3000);
    }
  }
}

module.exports = { publishToRelays };