const { relayInit } = require('nostr-tools');

class RelayManager {
  constructor(relayUrls, options = {}) {
    this.relayUrls = relayUrls;
    this.connections = new Map();
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 10000;
  }

  async connect(url) {
    if (this.connections.has(url)) {
      const conn = this.connections.get(url);
      if (conn.status === 'connected') return conn.relay;
    }

    const relay = relayInit(url);
    const conn = { relay, status: 'connecting', retries: 0 };
    this.connections.set(url, conn);

    relay.on('connect', () => {
      conn.status = 'connected';
      conn.retries = 0;
      console.log(`✅ Connected to ${url}`);
    });

    relay.on('disconnect', () => {
      conn.status = 'disconnected';
      console.log(`⚠️ Disconnected from ${url}`);
      this.scheduleReconnect(url);
    });

    relay.on('error', (err) => {
      console.error(`❌ Error on ${url}:`, err?.message || err);
      conn.status = 'error';
      this.scheduleReconnect(url);
    });

    relay.on('notice', (msg) => {
      console.log(`📢 Notice from ${url}: ${msg}`);
    });

    try {
      await Promise.race([
        relay.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.timeout)
        )
      ]);
      return relay;
    } catch (err) {
      console.error(`Failed to connect to ${url}:`, err.message);
      conn.status = 'error';
      this.scheduleReconnect(url);
      throw err;
    }
  }

  scheduleReconnect(url) {
    const conn = this.connections.get(url);
    if (!conn || conn.retries >= this.maxRetries) {
      console.error(`⛔ Max retries reached for ${url}`);
      return;
    }

    conn.retries++;
    setTimeout(() => {
      console.log(`🔄 Reconnecting to ${url} (attempt ${conn.retries}/${this.maxRetries})`);
      this.connect(url).catch(() => {});
    }, this.reconnectDelay * conn.retries);
  }

  async connectAll() {
    const results = await Promise.allSettled(
      this.relayUrls.map(url => this.connect(url))
    );
    
    const connected = results.filter(r => r.status === 'fulfilled').length;
    console.log(`📡 Connected to ${connected}/${this.relayUrls.length} relays`);
    
    return results;
  }

  async publish(event) {
    const results = [];
    
    for (const [url, conn] of this.connections) {
      if (conn.status !== 'connected') continue;

      try {
        await conn.relay.publish(event);
        results.push({ url, success: true });
        console.log(`✅ Published to ${url}`);
      } catch (err) {
        results.push({ url, success: false, error: err.message });
        console.error(`❌ Failed to publish to ${url}:`, err.message);
      }
    }

    return results;
  }

  getRelay(url) {
    const conn = this.connections.get(url);
    return conn?.status === 'connected' ? conn.relay : null;
  }

  async closeAll() {
    for (const [url, conn] of this.connections) {
      try {
        await conn.relay.close();
        console.log(`🔌 Closed connection to ${url}`);
      } catch (err) {
        console.error(`Error closing ${url}:`, err.message);
      }
    }
    this.connections.clear();
  }

  getStatus() {
    const status = {};
    for (const [url, conn] of this.connections) {
      status[url] = {
        status: conn.status,
        retries: conn.retries
      };
    }
    return status;
  }
}

module.exports = RelayManager;