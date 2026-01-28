const { relayInit } = require('nostr-tools');

class RelayManager {
  constructor(relayUrls, options = {}) {
    this.relayUrls = relayUrls;
    this.connections = new Map();
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 10000;
    this.publishTimeout = options.publishTimeout || 5000;
    this.isShuttingDown = false;
    this.maxPublishErrors = options.maxPublishErrors || 3;
  }

  async connect(url) {
    let conn;
    if (this.connections.has(url)) {
      conn = this.connections.get(url);
      if (conn.status === 'connected') return conn.relay;
      conn.status = 'connecting';
    }
   
    if(!conn){
      conn = { status: 'connecting', retries: 0, reconnectTimer: null, publishErrors: 0 };
      this.connections.set(url, conn);
    }

    const relay = relayInit(url);
    conn.relay = relay;

    relay.on('connect', () => {
      conn.status = 'connected';
      conn.retries = 0;
      conn.publishErrors = 0;
      if (conn.reconnectTimer) {
        clearTimeout(conn.reconnectTimer);
        conn.reconnectTimer = null;
      }
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
      throw err;
    }
  }

  scheduleReconnect(url) {
    if(this.isShuttingDown) return;

    const conn = this.connections.get(url);
    if (!conn || conn.retries >= this.maxRetries) {
      console.error(`⛔ Max retries reached for ${url}`);
      return;
    }

    if (conn.reconnectTimer){
      console.log(`⏳ Reconnect to ${url} already scheduled`);
      return;
    }

    conn.retries++;
    conn.reconnectTimer = setTimeout(() => {
      console.log(`🔄 Reconnecting to ${url} (attempt ${conn.retries}/${this.maxRetries})`);
      conn.reconnectTimer = null;
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
    let published = false;
    const results = [];
    
    for (const [url, conn] of this.connections) {
      if (conn.status !== 'connected') {
        console.warn(`⏭️  Skipping ${url} (status: ${conn.status})`);
        continue;
      }

      try {
        await Promise.race([
          conn.relay.publish(event),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout (${this.publishTimeout}ms)`)),
              this.publishTimeout
            )
          )
        ]);

        console.log(`✅ Published to ${url}`);
        results.push({ url, success: true });
        published = true;

      } catch (err) {
        console.warn(`⚠️ Failed to publish to ${url}: ${err.message}`);
        conn.publishErrors++;
        if (conn.publishErrors >= this.maxPublishErrors) {
          console.error(`⛔ Max publish errors reached for ${url}, disabling relay.`);
          conn.status = 'disabled';
        }
        results.push({ url, success: false, error: err.message });
      }
    }

    if (published) {
      console.log(`✅ Event published successfully`);
    } else {
      console.error(`❌ Failed to publish to all relays. Checking connections in background...`);
      this.healthCheck();
    }

    return {
      success: published,
      results
    };
  }

  async healthCheck() {
    const status = this.getStatus();
    const allDisconnected = Object.values(status).every(s => !['connected', 'connecting'].includes(s.status));
    if (allDisconnected) {
      console.log(`🔄 All relays disconnected, attempting to reconnect...`);
      await this.connectAll();
      return this.getStatus();
    }
    console.log(`📊 Health check: ${JSON.stringify(status, null, 2)}\n`);
    return status;
  }

  getRelay(url) {
    const conn = this.connections.get(url);
    return conn?.status === 'connected' ? conn.relay : null;
  }

  async closeAll() {
    this.isShuttingDown = true;
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