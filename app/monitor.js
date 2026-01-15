const fs = require('fs');
const path = require('path');

class Monitor {
  constructor() {
    this.metrics = {
      uptime: Date.now(),
      cycles: 0,
      successfulPosts: 0,
      failedPosts: 0,
      totalErrors: 0,
      relayHealth: {},
      feedHealth: {},
      lastCycleTime: null,
      averageCycleTime: 0
    };
    
    this.errors = [];
    this.maxStoredErrors = 50;
    
    this.metricsFile = path.resolve('data', 'metrics.json');
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        const data = JSON.parse(fs.readFileSync(this.metricsFile, 'utf-8'));
        this.metrics = { ...this.metrics, ...data };
      }
    } catch (err) {
      console.error('⚠️ Error loading metrics:', err.message);
    }
  }

  save() {
    try {
      const dataDir = path.dirname(this.metricsFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (err) {
      console.error('❌ Error saving metrics:', err.message);
    }
  }

  recordCycleStart() {
    this.cycleStartTime = Date.now();
    this.metrics.cycles++;
  }

  recordCycleEnd() {
    if (!this.cycleStartTime) return;
    
    const duration = Date.now() - this.cycleStartTime;
    this.metrics.lastCycleTime = duration;
    
    // Calcula média móvel
    const alpha = 0.2; // Peso para nova medição
    this.metrics.averageCycleTime = this.metrics.averageCycleTime === 0
      ? duration
      : this.metrics.averageCycleTime * (1 - alpha) + duration * alpha;
    
    this.cycleStartTime = null;
    this.save();
  }

  recordPost(success, feedName = null) {
    if (success) {
      this.metrics.successfulPosts++;
      if (feedName) {
        this.recordFeedSuccess(feedName);
      }
    } else {
      this.metrics.failedPosts++;
      if (feedName) {
        this.recordFeedFailure(feedName);
      }
    }
    this.save();
  }

  recordRelayPublish(relayUrl, success) {
    if (!this.metrics.relayHealth[relayUrl]) {
      this.metrics.relayHealth[relayUrl] = {
        successes: 0,
        failures: 0,
        lastSuccess: null,
        lastFailure: null
      };
    }
    
    const health = this.metrics.relayHealth[relayUrl];
    
    if (success) {
      health.successes++;
      health.lastSuccess = Date.now();
    } else {
      health.failures++;
      health.lastFailure = Date.now();
    }
    
    this.save();
  }

  recordFeedSuccess(feedName) {
    if (!this.metrics.feedHealth[feedName]) {
      this.metrics.feedHealth[feedName] = {
        successes: 0,
        failures: 0,
        lastSuccess: null,
        lastFailure: null
      };
    }
    
    this.metrics.feedHealth[feedName].successes++;
    this.metrics.feedHealth[feedName].lastSuccess = Date.now();
    this.save();
  }

  recordFeedFailure(feedName) {
    if (!this.metrics.feedHealth[feedName]) {
      this.metrics.feedHealth[feedName] = {
        successes: 0,
        failures: 0,
        lastSuccess: null,
        lastFailure: null
      };
    }
    
    this.metrics.feedHealth[feedName].failures++;
    this.metrics.feedHealth[feedName].lastFailure = Date.now();
    this.save();
  }

  recordError(error, context = {}) {
    this.metrics.totalErrors++;
    
    const errorEntry = {
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      context
    };
    
    this.errors.unshift(errorEntry);
    
    // Limita tamanho do array
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(0, this.maxStoredErrors);
    }
    
    this.save();
  }

  getUptime() {
    const ms = Date.now() - this.metrics.uptime;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  getSuccessRate() {
    const total = this.metrics.successfulPosts + this.metrics.failedPosts;
    if (total === 0) return 0;
    return ((this.metrics.successfulPosts / total) * 100).toFixed(2);
  }

  getRelayHealthReport() {
    const report = [];
    
    for (const [url, health] of Object.entries(this.metrics.relayHealth)) {
      const total = health.successes + health.failures;
      const successRate = total > 0 
        ? ((health.successes / total) * 100).toFixed(1)
        : 0;
      
      report.push({
        url,
        successRate: `${successRate}%`,
        total,
        lastSuccess: health.lastSuccess 
          ? new Date(health.lastSuccess).toISOString()
          : 'Never'
      });
    }
    
    return report.sort((a, b) => b.total - a.total);
  }

  getFeedHealthReport() {
    const report = [];
    
    for (const [name, health] of Object.entries(this.metrics.feedHealth)) {
      const total = health.successes + health.failures;
      const successRate = total > 0
        ? ((health.successes / total) * 100).toFixed(1)
        : 0;
      
      report.push({
        name,
        successRate: `${successRate}%`,
        posts: health.successes,
        lastSuccess: health.lastSuccess
          ? new Date(health.lastSuccess).toISOString()
          : 'Never'
      });
    }
    
    return report.sort((a, b) => b.posts - a.posts);
  }

  getRecentErrors(limit = 10) {
    return this.errors.slice(0, limit).map(err => ({
      timestamp: new Date(err.timestamp).toISOString(),
      message: err.message,
      context: err.context
    }));
  }

  getSummary() {
    return {
      uptime: this.getUptime(),
      cycles: this.metrics.cycles,
      posts: {
        successful: this.metrics.successfulPosts,
        failed: this.metrics.failedPosts,
        successRate: `${this.getSuccessRate()}%`
      },
      errors: this.metrics.totalErrors,
      lastCycle: this.metrics.lastCycleTime
        ? `${(this.metrics.lastCycleTime / 1000).toFixed(2)}s`
        : 'N/A',
      avgCycle: this.metrics.averageCycleTime
        ? `${(this.metrics.averageCycleTime / 1000).toFixed(2)}s`
        : 'N/A'
    };
  }

  printDashboard() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 NOSTRIFEED BOT DASHBOARD');
    console.log('='.repeat(60));
    
    const summary = this.getSummary();
    console.log(`\n⏱️  Uptime: ${summary.uptime}`);
    console.log(`🔄 Cycles: ${summary.cycles}`);
    console.log(`✅ Success Rate: ${summary.posts.successRate}`);
    console.log(`📝 Posts: ${summary.posts.successful} successful, ${summary.posts.failed} failed`);
    console.log(`❌ Total Errors: ${summary.errors}`);
    console.log(`⚡ Last Cycle: ${summary.lastCycle}`);
    console.log(`📊 Avg Cycle: ${summary.avgCycle}`);
    
    console.log('\n📡 RELAY HEALTH:');
    const relayHealth = this.getRelayHealthReport();
    relayHealth.slice(0, 5).forEach(relay => {
      console.log(`  ${relay.url}`);
      console.log(`    Success Rate: ${relay.successRate} (${relay.total} total)`);
    });
    
    console.log('\n📰 TOP FEEDS:');
    const feedHealth = this.getFeedHealthReport();
    feedHealth.slice(0, 5).forEach(feed => {
      console.log(`  ${feed.name}: ${feed.posts} posts (${feed.successRate})`);
    });
    
    const recentErrors = this.getRecentErrors(3);
    if (recentErrors.length > 0) {
      console.log('\n⚠️  RECENT ERRORS:');
      recentErrors.forEach(err => {
        console.log(`  [${err.timestamp}] ${err.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }

  reset() {
    this.metrics = {
      uptime: Date.now(),
      cycles: 0,
      successfulPosts: 0,
      failedPosts: 0,
      totalErrors: 0,
      relayHealth: {},
      feedHealth: {},
      lastCycleTime: null,
      averageCycleTime: 0
    };
    this.errors = [];
    this.save();
    console.log('✅ Metrics reset successfully');
  }
}

// Singleton
const monitor = new Monitor();

module.exports = monitor;