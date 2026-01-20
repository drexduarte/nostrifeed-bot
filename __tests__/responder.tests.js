const { parseCommand, handleCommand, commands } = require('../app/responder');

// Mock dependencies
jest.mock('../app/config');
jest.mock('../app/store');

const { getConfig } = require('../app/config');
const store = require('../app/store');

describe('Responder Module', () => {
  const botPubkey = 'botpubkey';
  const botPrivkey = 'botprivkey';
  const nip05 = 'botnip05';
  const mockRelayUrl = 'wss://relay.example.com';
  const relayManager = {};

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    getConfig.mockReturnValue({
      feeds: [
        { name: 'CoinDesk' },
        { name: 'Bitcoin Magazine' },
        { name: 'CNN Brasil' }
      ]
    });

    store.getStats.mockReturnValue({
      totalPublished: 100,
      totalResponded: 50,
      totalStored: 100,
      lastRun: 1704067200 // 2024-01-01 00:00:00
    });

    store.getFeedStats.mockReturnValue({
      'coindesk': 30,
      'bitcoin-magazine': 25,
      'cnn-brasil': 20
    });

    store.getCategories.mockReturnValue(['technology', 'business', 'crypto']);
    
    store.fetchLatestNews.mockReturnValue([
      'Article 1\nhttps://example.com/1',
      'Article 2\nhttps://example.com/2',
      'Article 3\nhttps://example.com/3'
    ]);
  });

  describe('parseCommand()', () => {
    it('should parse simple commands', () => {
      const result = parseCommand('!help');
      expect(result).toEqual({
        command: 'help',
        arg: undefined
      });
    });

    it('should parse commands with arguments', () => {
      const result = parseCommand('!latest bitcoin');
      expect(result).toEqual({
        command: 'latest',
        arg: 'bitcoin'
      });
    });

    it('should parse commands with multiple word arguments', () => {
      const result = parseCommand('!latest bitcoin magazine');
      expect(result).toEqual({
        command: 'latest',
        arg: 'bitcoin magazine'
      });
    });

    it('should ignore npub mentions before command', () => {
      const result = parseCommand('nostr:npub1abc123 !help');
      expect(result).toEqual({
        command: 'help',
        arg: undefined
      });
    });

    it('should handle npub mentions without nostr: prefix', () => {
      const result = parseCommand('npub1abc123 !feeds');
      expect(result).toEqual({
        command: 'feeds',
        arg: undefined
      });
    });

    it('should return null for non-commands', () => {
      expect(parseCommand('Hello bot')).toBeNull();
      expect(parseCommand('Just a regular message')).toBeNull();
    });

    it('should return null for empty strings', () => {
      expect(parseCommand('')).toBeNull();
    });

    it('should be case insensitive for commands', () => {
      const result = parseCommand('!HELP');
      expect(result).toEqual({
        command: 'help',
        arg: undefined
      });
    });

    it('should handle extra whitespace', () => {
      const result = parseCommand('  !help  ');
      expect(result).toEqual({
        command: 'help',
        arg: undefined
      });
    });

    it('should preserve arg casing', () => {
      const result = parseCommand('!latest Bitcoin Magazine');
      expect(result).toEqual({
        command: 'latest',
        arg: 'Bitcoin Magazine'
      });
    });
  });

  describe('commands.feeds()', () => {
    it('should list all feeds', () => {
      const response = commands.feeds();
      
      expect(response).toContain('Available feeds (3)');
      expect(response).toContain('CoinDesk');
      expect(response).toContain('Bitcoin Magazine');
      expect(response).toContain('CNN Brasil');
    });

    it('should format as bullet list', () => {
      const response = commands.feeds();
      expect(response).toMatch(/• CoinDesk/);
      expect(response).toMatch(/• Bitcoin Magazine/);
    });

    it('should handle empty feed list', () => {
      getConfig.mockReturnValue({ feeds: [] });
      const response = commands.feeds();
      expect(response).toContain('Available feeds (0)');
    });
  });

  describe('commands.latest()', () => {
    it('should require an argument', () => {
      const response = commands.latest();
      expect(response).toContain('Please specify a feed name or category');
      expect(response).toContain('Example: !latest bitcoin-magazine');
    });

    it('should fetch latest news for valid category', () => {
      const response = commands.latest('bitcoin');
      
      expect(store.fetchLatestNews).toHaveBeenCalledWith('bitcoin', 3, false);
      expect(response).toContain('Latest news from "bitcoin"');
      expect(response).toContain('Article 1');
      expect(response).toContain('https://example.com/1');
    });

    it('should detect feed names and use feed mode', () => {
      const response = commands.latest('CoinDesk');
      
      expect(store.fetchLatestNews).toHaveBeenCalledWith('coindesk', 3, true);
    });

    it('should handle no results', () => {
      store.fetchLatestNews.mockReturnValue([]);
      const response = commands.latest('nonexistent');
      
      expect(response).toContain('No news found for "nonexistent"');
      expect(response).toContain('Try !feeds');
    });

    it('should format multiple results', () => {
      const response = commands.latest('bitcoin');
      
      expect(response).toContain('Article 1');
      expect(response).toContain('Article 2');
      expect(response).toContain('Article 3');
    });
  });

  describe('commands.categories()', () => {
    it('should list all categories', () => {
      const response = commands.categories();
      
      expect(response).toContain('Available categories (3)');
      expect(response).toContain('#technology');
      expect(response).toContain('#business');
      expect(response).toContain('#crypto');
    });

    it('should format as hashtags', () => {
      const response = commands.categories();
      expect(response).toMatch(/• #technology/);
    });

    it('should handle no categories', () => {
      store.getCategories.mockReturnValue([]);
      const response = commands.categories();
      
      expect(response).toContain('No categories found yet');
    });
  });

  describe('commands.stats()', () => {
    it('should display bot statistics', () => {
      const response = commands.stats();
      
      expect(response).toContain('Bot Statistics');
      expect(response).toContain('Total published: 100');
      expect(response).toContain('Total responses: 50');
      expect(response).toContain('Stored items: 100');
    });

    it('should format last run timestamp', () => {
      const response = commands.stats();
      expect(response).toMatch(/Last run: \d{4}-\d{2}-\d{2}/);
    });

    it('should show top 5 feeds', () => {
      const response = commands.stats();
      
      expect(response).toContain('Top Feeds');
      expect(response).toContain('coindesk: 30');
      expect(response).toContain('bitcoin-magazine: 25');
    });

    it('should handle no feed stats', () => {
      store.getFeedStats.mockReturnValue({});
      const response = commands.stats();
      
      expect(response).not.toContain('Top Feeds');
    });

    it('should handle null lastRun', () => {
      store.getStats.mockReturnValue({
        totalPublished: 0,
        totalResponded: 0,
        totalStored: 0,
        lastRun: null
      });

      const response = commands.stats();
      expect(response).toContain('Last run: Never');
    });
  });

  describe('commands.help()', () => {
    it('should list all available commands', () => {
      const response = commands.help();
      
      expect(response).toContain('NostriFeed Bot Commands');
      expect(response).toContain('!feeds');
      expect(response).toContain('!latest');
      expect(response).toContain('!categories');
      expect(response).toContain('!stats');
      expect(response).toContain('!help');
    });

    it('should include usage examples', () => {
      const response = commands.help();
      expect(response).toContain('Example: !latest coindesk');
    });

    it('should include helpful tip', () => {
      const response = commands.help();
      expect(response).toContain('Mention me with a command to interact');
    });
  });

  describe('command execution flow', () => {
    it('should handle unknown commands gracefully', () => {
      // This would be tested in the full handleCommand function
      // which we haven't fully tested here as it requires more mocking
      expect(commands['unknown-command']).toBeUndefined();
    });

    it('should handle errors in command execution', () => {
      store.getCategories.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(() => commands.categories()).toThrow('Database error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle feed names with special characters', () => {
      getConfig.mockReturnValue({
        feeds: [{ name: 'Bitcoin & Crypto News' }]
      });

      const response = commands.feeds();
      expect(response).toContain('Bitcoin & Crypto News');
    });

    it('should handle very long feed lists', () => {
      const manyFeeds = Array.from({ length: 50 }, (_, i) => ({
        name: `Feed ${i + 1}`
      }));
      
      getConfig.mockReturnValue({ feeds: manyFeeds });
      const response = commands.feeds();
      
      expect(response).toContain('Available feeds (50)');
    });

    it('should handle feed names that look like categories', () => {
      store.fetchLatestNews.mockReturnValue([
        'News item\nhttps://example.com'
      ]);

      const response = commands.latest('technology'); // Could be feed or category
      expect(response).toContain('Latest news from "technology"');
    });
  });

  describe('event handling', () => {
    it('should not respond to own events', async () => {
      const event = { pubkey: 'botpubkey', id: 'event1' };

      store.wasResponded.mockReturnValue(false);

      await handleCommand(event, botPubkey, botPrivkey, nip05, relayManager, mockRelayUrl);

      expect(store.wasResponded).not.toHaveBeenCalledWith(event.id);
    });

    it('should not respond to already responded events', async () => {
      const event = { pubkey: 'pubkey', id: 'event1' };

      store.wasResponded.mockReturnValue(true);

      await handleCommand(event, botPubkey, botPrivkey, nip05, relayManager, mockRelayUrl);

      expect(store.wasResponded).toHaveBeenCalledWith(event.id);
    });
  });
});