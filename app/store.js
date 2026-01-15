const fs = require('fs');
const path = require('path');
const { generateContentHash } = require('./utils');

const PUBLISHED_FILE = path.resolve('data', 'published.json');
const RESPONDED_EVENTS_FILE = path.resolve('data', 'responded_events.json');
const STATS_FILE = path.resolve('data', 'stats.json');

// Garante que o diretório data existe
const dataDir = path.dirname(PUBLISHED_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Store {
  constructor() {
    this.publishedLinks = [];
    this.respondedEvents = new Map();
    this.stats = {
      totalPublished: 0,
      totalResponded: 0,
      lastRun: null,
      feedStats: {}
    };
    
    this.load();
  }

  load() {
    // Carrega links publicados
    try {
      if (fs.existsSync(PUBLISHED_FILE)) {
        const data = JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf-8'));
        this.publishedLinks = Array.isArray(data.links) ? data.links : [];
      }
    } catch (err) {
      console.error('⚠️ Error loading published links:', err.message);
      this.publishedLinks = [];
    }

    // Carrega eventos respondidos
    try {
      if (fs.existsSync(RESPONDED_EVENTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(RESPONDED_EVENTS_FILE, 'utf-8'));
        this.respondedEvents = new Map(Array.isArray(data.events) ? data.events : []);
      }
    } catch (err) {
      console.error('⚠️ Error loading responded events:', err.message);
      this.respondedEvents = new Map();
    }

    // Carrega estatísticas
    try {
      if (fs.existsSync(STATS_FILE)) {
        this.stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      }
    } catch (err) {
      console.error('⚠️ Error loading stats:', err.message);
    }

    this.cleanupOldData();
  }

  save() {
    try {
      fs.writeFileSync(
        PUBLISHED_FILE,
        JSON.stringify({ links: this.publishedLinks }, null, 2)
      );
    } catch (err) {
      console.error('❌ Error saving published links:', err.message);
    }
  }

  saveRespondedEvents() {
    try {
      fs.writeFileSync(
        RESPONDED_EVENTS_FILE,
        JSON.stringify({ events: Array.from(this.respondedEvents.entries()) }, null, 2)
      );
    } catch (err) {
      console.error('❌ Error saving responded events:', err.message);
    }
  }

  saveStats() {
    try {
      fs.writeFileSync(
        STATS_FILE,
        JSON.stringify(this.stats, null, 2)
      );
    } catch (err) {
      console.error('❌ Error saving stats:', err.message);
    }
  }

  cleanupOldData() {
    const now = Date.now() / 1000;
    const oneDayAgo = now - (24 * 3600);
    
    // Remove eventos respondidos com mais de 24 horas
    for (const [id, timestamp] of this.respondedEvents) {
      if (timestamp < oneDayAgo) {
        this.respondedEvents.delete(id);
      }
    }
    
    if (this.respondedEvents.size > 0) {
      this.saveRespondedEvents();
    }
  }

  addRespondedEvent(eventId) {
    this.respondedEvents.set(eventId, Date.now() / 1000);
    this.stats.totalResponded++;
    this.saveRespondedEvents();
    this.saveStats();
  }

  wasResponded(eventId) {
    return this.respondedEvents.has(eventId);
  }

  addPublishedLink(link, maxStoredLinks = 500, category = '', feed = '', title = '') {
    const entry = {
      url: link,
      hash: generateContentHash(title, link),
      category: category.trim(),
      feed: feed.trim(),
      title: title.trim(),
      timestamp: Date.now() / 1000
    };

    this.publishedLinks.push(entry);
    
    // Limita tamanho
    if (maxStoredLinks > 0 && this.publishedLinks.length > maxStoredLinks) {
      this.publishedLinks = this.publishedLinks.slice(-maxStoredLinks);
    }

    // Atualiza estatísticas
    this.stats.totalPublished++;
    this.stats.lastRun = Date.now() / 1000;
    if (feed) {
      this.stats.feedStats[feed] = (this.stats.feedStats[feed] || 0) + 1;
    }

    this.save();
    this.saveStats();
  }

  wasPublished(link, title = '') {
    const normalizedUrl = link.toLowerCase();
    const hash = generateContentHash(title, link);
    
    return this.publishedLinks.some(entry => 
      entry.url.toLowerCase() === normalizedUrl || entry.hash === hash
    );
  }

  getPublishedLinks() {
    return this.publishedLinks;
  }

  fetchLatestNews(category = '', limit = 5, isFeed = false) {
    const filtered = category
      ? this.publishedLinks.filter(entry => 
          isFeed
            ? entry.feed?.toLowerCase() === category.toLowerCase()
            : entry.category?.toLowerCase() === category.toLowerCase()
        )
      : this.publishedLinks;

    return filtered
      .slice(-limit)
      .reverse()
      .map(entry => `${entry.title}\n${entry.url}`);
  }

  getCategories() {
    return [...new Set(
      this.publishedLinks
        .map(link => link.category)
        .filter(Boolean)
    )];
  }

  getStats() {
    return {
      ...this.stats,
      totalStored: this.publishedLinks.length,
      respondedEventsStored: this.respondedEvents.size
    };
  }

  getFeedStats() {
    return this.stats.feedStats;
  }

  // Exporta dados para backup
  exportData() {
    return {
      publishedLinks: this.publishedLinks,
      respondedEvents: Array.from(this.respondedEvents.entries()),
      stats: this.stats,
      exportedAt: Date.now() / 1000
    };
  }

  // Importa dados de backup
  importData(data) {
    if (data.publishedLinks) this.publishedLinks = data.publishedLinks;
    if (data.respondedEvents) this.respondedEvents = new Map(data.respondedEvents);
    if (data.stats) this.stats = data.stats;
    
    this.save();
    this.saveRespondedEvents();
    this.saveStats();
  }
}

// Singleton
const store = new Store();

module.exports = store;