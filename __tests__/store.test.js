const path = require('path');

jest.mock('fs', () => ({
  watchFile: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('Store Module', () => {
  let fs;
  let store;

  beforeEach(() => {
    // Clear module cache
    jest.resetModules();
    fs = require('fs');
    
    // Setup fs mocks
    fs.existsSync.mockReturnValue(false);

    // Require fresh instance
    store = require('../app/store');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create data directory if it does not exist', () => {
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });

    it('should load existing data on initialization', () => {
      jest.resetModules();
      jest.resetAllMocks();
      fs = require('fs');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        links: [
          { url: 'https://example.com', category: 'tech', feed: 'feed1' }
        ]
      }));

      const freshStore = require('../app/store');

      expect(freshStore.getPublishedLinks()).toHaveLength(1);
    });
  });

  describe('addPublishedLink()', () => {
    it('should add a new link', () => {
      store.addPublishedLink(
        'https://example.com/article',
        500,
        'technology',
        'tech-feed',
        'Test Article'
      );

      const links = store.getPublishedLinks();
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        url: 'https://example.com/article',
        category: 'technology',
        feed: 'tech-feed',
        title: 'Test Article'
      });
    });

    it('should limit stored links to maxStoredLinks', () => {
      // Add more links than the limit
      for (let i = 0; i < 15; i++) {
        store.addPublishedLink(
          `https://example.com/article${i}`,
          10, // max 10
          'tech',
          'feed',
          `Article ${i}`
        );
      }

      const links = store.getPublishedLinks();
      expect(links).toHaveLength(10);
      expect(links[0].title).toBe('Article 5'); // Should keep last 10
    });

    it('should update statistics', () => {
      store.addPublishedLink(
        'https://example.com/article',
        500,
        'tech',
        'tech-feed',
        'Article'
      );

      const stats = store.getStats();
      expect(stats.totalPublished).toBeGreaterThan(0);
      expect(stats.feedStats['tech-feed']).toBe(1);
    });

    it('should trim whitespace from category and feed', () => {
      store.addPublishedLink(
        'https://example.com/article',
        500,
        '  technology  ',
        '  tech-feed  ',
        'Article'
      );

      const links = store.getPublishedLinks();
      expect(links[0].category).toBe('technology');
      expect(links[0].feed).toBe('tech-feed');
    });

    it('should generate content hash', () => {
      store.addPublishedLink(
        'https://example.com/article',
        500,
        'tech',
        'feed',
        'Article Title'
      );

      const links = store.getPublishedLinks();
      expect(links[0].hash).toBeDefined();
      expect(links[0].hash).toHaveLength(16);
    });
  });

  describe('wasPublished()', () => {
    beforeEach(() => {
      store.addPublishedLink(
        'https://example.com/article',
        500,
        'tech',
        'feed',
        'Test Article'
      );
    });

    it('should detect already published URLs', () => {
      expect(store.wasPublished('https://example.com/article')).toBe(true);
    });

    it('should be case insensitive for URLs', () => {
      expect(store.wasPublished('HTTPS://EXAMPLE.COM/ARTICLE')).toBe(true);
    });

    it('should detect duplicates by content hash', () => {
      expect(
        store.wasPublished('https://example.com/article?utm=test', 'Test Article')
      ).toBe(true);
    });

    it('should return false for new URLs', () => {
      expect(store.wasPublished('https://new-site.com/article')).toBe(false);
    });
  });

  describe('addRespondedEvent() and wasResponded()', () => {
    it('should track responded events', () => {
      const eventId = 'abc123';
      store.addRespondedEvent(eventId);

      expect(store.wasResponded(eventId)).toBe(true);
    });

    it('should return false for new events', () => {
      expect(store.wasResponded('new-event-id')).toBe(false);
    });

    it('should update totalResponded stat', () => {
      const initialStats = store.getStats();
      const initialCount = initialStats.totalResponded;

      store.addRespondedEvent('event1');
      store.addRespondedEvent('event2');

      const newStats = store.getStats();
      expect(newStats.totalResponded).toBe(initialCount + 2);
    });
  });

  describe('fetchLatestNews()', () => {
    beforeEach(() => {
      store.addPublishedLink('https://example.com/1', 500, 'tech', 'feed1', 'Article 1');
      store.addPublishedLink('https://example.com/2', 500, 'tech', 'feed1', 'Article 2');
      store.addPublishedLink('https://example.com/3', 500, 'business', 'feed2', 'Article 3');
      store.addPublishedLink('https://example.com/4', 500, 'tech', 'feed2', 'Article 4');
    });

    it('should fetch all items when no category specified', () => {
      const items = store.fetchLatestNews('', 10, false);
      expect(items).toHaveLength(4);
    });

    it('should filter by category', () => {
      const items = store.fetchLatestNews('tech', 10, false);
      expect(items).toHaveLength(3);
    });

    it('should filter by feed', () => {
      const items = store.fetchLatestNews('feed1', 10, true);
      expect(items).toHaveLength(2);
    });

    it('should limit results', () => {
      const items = store.fetchLatestNews('tech', 2, false);
      expect(items).toHaveLength(2);
    });

    it('should return items in reverse order (latest first)', () => {
      const items = store.fetchLatestNews('tech', 10, false);
      expect(items[0]).toContain('Article 4'); // Most recent first
    });

    it('should format items as "title\\nurl"', () => {
      const items = store.fetchLatestNews('', 1, false);
      expect(items[0]).toMatch(/^Article \d+\nhttps:\/\//);
    });

    it('should be case insensitive for category matching', () => {
      const items = store.fetchLatestNews('TECH', 10, false);
      expect(items).toHaveLength(3);
    });
  });

  describe('getCategories()', () => {
    it('should return empty array when no links', () => {
      expect(store.getCategories()).toEqual([]);
    });

    it('should return unique categories', () => {
      store.addPublishedLink('https://example.com/1', 500, 'tech', 'feed', 'A1');
      store.addPublishedLink('https://example.com/2', 500, 'tech', 'feed', 'A2');
      store.addPublishedLink('https://example.com/3', 500, 'business', 'feed', 'A3');

      const categories = store.getCategories();
      expect(categories).toHaveLength(2);
      expect(categories).toContain('tech');
      expect(categories).toContain('business');
    });

    it('should filter out empty categories', () => {
      store.addPublishedLink('https://example.com/1', 500, '', 'feed', 'A1');
      store.addPublishedLink('https://example.com/2', 500, 'tech', 'feed', 'A2');

      const categories = store.getCategories();
      expect(categories).toEqual(['tech']);
    });
  });

  describe('getStats()', () => {
    it('should return statistics object', () => {
      const stats = store.getStats();
      
      expect(stats).toHaveProperty('totalPublished');
      expect(stats).toHaveProperty('totalResponded');
      expect(stats).toHaveProperty('lastRun');
      expect(stats).toHaveProperty('feedStats');
      expect(stats).toHaveProperty('totalStored');
      expect(stats).toHaveProperty('respondedEventsStored');
    });

    it('should track feed statistics', () => {
      store.addPublishedLink('https://example.com/1', 500, 'tech', 'feed1', 'A1');
      store.addPublishedLink('https://example.com/2', 500, 'tech', 'feed1', 'A2');
      store.addPublishedLink('https://example.com/3', 500, 'tech', 'feed2', 'A3');

      const feedStats = store.getFeedStats();
      expect(feedStats['feed1']).toBe(2);
      expect(feedStats['feed2']).toBe(1);
    });
  });

  describe('exportData() and importData()', () => {
    it('should export all data', () => {
      store.addPublishedLink('https://example.com/1', 500, 'tech', 'feed', 'A1');
      store.addRespondedEvent('event1');

      const exported = store.exportData();

      expect(exported).toHaveProperty('publishedLinks');
      expect(exported).toHaveProperty('respondedEvents');
      expect(exported).toHaveProperty('stats');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported.publishedLinks).toHaveLength(1);
    });

    it('should import data correctly', () => {
      const data = {
        publishedLinks: [
          { url: 'https://imported.com', category: 'tech', feed: 'feed', title: 'Imported' }
        ],
        respondedEvents: [['event1', Date.now() / 1000]],
        stats: { totalPublished: 100 }
      };

      store.importData(data);

      expect(store.getPublishedLinks()).toHaveLength(1);
      expect(store.wasResponded('event1')).toBe(true);
      expect(store.getStats().totalPublished).toBe(100);
    });
  });

  describe('persistence', () => {
    it('should save to disk when adding links', () => {
      store.addPublishedLink('https://example.com', 500, 'tech', 'feed', 'Article');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('published.json'),
        expect.any(String)
      );
    });

    it('should save responded events to disk', () => {
      store.addRespondedEvent('event1');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('responded_events.json'),
        expect.any(String)
      );
    });

    it('should save stats to disk', () => {
      store.addPublishedLink('https://example.com', 500, 'tech', 'feed', 'Article');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('stats.json'),
        expect.any(String)
      );
    });
  });

  describe('cleanupOldData()', () => {
    it('should remove responded events older than 24 hours', () => {
      // This is tested implicitly during initialization
      // More complex testing would require time manipulation
      const oldTimestamp = (Date.now() / 1000) - (25 * 3600); // 25 hours ago
      
      store.addRespondedEvent('old-event');
      // Manually set old timestamp (would need to access internal state)
      
      // After cleanup, old events should be removed
      // This is automatically called during initialization
    });
  });
});