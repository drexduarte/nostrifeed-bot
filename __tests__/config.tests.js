jest.mock('fs', () => ({
  watchFile: jest.fn(),
  readFileSync: jest.fn()
}));

describe('Config Module', () => {
  let fs;
  let mockConfigData;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fs = require('fs');

    mockConfigData = {
      botName: 'Test Bot',
      botDescription: 'A test bot',
      feeds: [
        { name: 'Feed 1', url: 'https://feed1.com/rss' },
        { name: 'Feed 2', url: 'https://feed2.com/rss' }
      ],
      relays: ['wss://relay1.com', 'wss://relay2.com'],
      itemsPerFeed: 5,
      maxStoredLinks: 500,
      filters: {
        exclude_keywords: ['sports']
      }
    };

    fs.readFileSync.mockReturnValue(JSON.stringify(mockConfigData));
  });

  describe('getConfig()', () => {
    it('should load and return config on first call', () => {
      const { getConfig } = require('../app/config');
      const result = getConfig();

      expect(fs.readFileSync).toHaveBeenCalledWith('config.json', 'utf-8');
      expect(result).toEqual(mockConfigData);
    });

    it('should return same config on subsequent calls', () => {
      const { getConfig } = require('../app/config');
      
      const result1 = getConfig();
      const result2 = getConfig();

      expect(result1).toEqual(result2);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should handle missing config file', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      expect(() => {
        require('../app/config');
      }).toThrow();
    });

    it('should handle invalid JSON', () => {
      fs.readFileSync.mockReturnValue('invalid json {');

      expect(() => {
        require('../app/config');
      }).toThrow();
    });
  });

  describe('watchConfig()', () => {
    it('should setup file watcher', () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfigData));
      const { watchConfig } = require('../app/config');
      const callback = jest.fn();

      watchConfig(callback);

      expect(fs.watchFile).toHaveBeenCalledWith(
        'config.json',
        expect.any(Function)
      );
    });

    it('should reload config when file changes', () => {
      const { watchConfig, getConfig } = require('../app/config');
      const callback = jest.fn();

      watchConfig(callback);

      // Get the watcher callback
      const watcherCallback = fs.watchFile.mock.calls[0][1];

      // Simulate file change
      const newConfig = { ...mockConfigData, botName: 'Updated Bot' };
      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));
      
      watcherCallback();

      const updatedConfig = getConfig();
      expect(updatedConfig.botName).toBe('Updated Bot');
      expect(callback).toHaveBeenCalledWith(newConfig);
    });

    it('should handle errors during reload', () => {
      const { watchConfig } = require('../app/config');
      const callback = jest.fn();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      watchConfig(callback);

      const watcherCallback = fs.watchFile.mock.calls[0][1];

      // Simulate error during reload
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      watcherCallback();

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao recarregar config.json'),
        expect.any(Error)
      );
      expect(callback).not.toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should work without callback', () => {
      const { watchConfig } = require('../app/config');

      expect(() => {
        watchConfig();
      }).not.toThrow();

      const watcherCallback = fs.watchFile.mock.calls[0][1];
      
      const newConfig = { ...mockConfigData };
      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));

      expect(() => {
        watcherCallback();
      }).not.toThrow();
    });

    it('should log success message on reload', () => {
      const { watchConfig } = require('../app/config');
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      watchConfig();

      const watcherCallback = fs.watchFile.mock.calls[0][1];
      const newConfig = { ...mockConfigData };
      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));

      watcherCallback();

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('config.json recarregado com sucesso')
      );

      consoleLog.mockRestore();
    });
  });

  describe('config structure validation', () => {
    it('should contain required fields', () => {
      const { getConfig } = require('../app/config');
      const result = getConfig();

      expect(result).toHaveProperty('botName');
      expect(result).toHaveProperty('botDescription');
      expect(result).toHaveProperty('feeds');
      expect(result).toHaveProperty('relays');
    });

    it('should have feeds as array', () => {
      const { getConfig } = require('../app/config');
      const result = getConfig();

      expect(Array.isArray(result.feeds)).toBe(true);
    });

    it('should have relays as array', () => {
      const { getConfig } = require('../app/config');
      const result = getConfig();

      expect(Array.isArray(result.relays)).toBe(true);
    });

    it('should have valid feed structure', () => {
      const { getConfig } = require('../app/config');
      const result = getConfig();

      result.feeds.forEach(feed => {
        expect(feed).toHaveProperty('name');
        expect(feed).toHaveProperty('url');
        expect(typeof feed.name).toBe('string');
        expect(typeof feed.url).toBe('string');
      });
    });
  });

  describe('config updates', () => {
    it('should allow adding new feeds', () => {
      const { watchConfig, getConfig } = require('../app/config');
      
      watchConfig();
      const watcherCallback = fs.watchFile.mock.calls[0][1];

      const updatedConfig = {
        ...mockConfigData,
        feeds: [
          ...mockConfigData.feeds,
          { name: 'Feed 3', url: 'https://feed3.com/rss' }
        ]
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(updatedConfig));
      watcherCallback();

      const result = getConfig();
      expect(result.feeds).toHaveLength(3);
    });

    it('should allow changing filters', () => {
      const { watchConfig, getConfig } = require('../app/config');
      
      watchConfig();
      const watcherCallback = fs.watchFile.mock.calls[0][1];

      const updatedConfig = {
        ...mockConfigData,
        filters: {
          exclude_keywords: ['sports', 'politics']
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(updatedConfig));
      watcherCallback();

      const result = getConfig();
      expect(result.filters.exclude_keywords).toHaveLength(2);
    });

    it('should allow changing relay list', () => {
      const { watchConfig, getConfig } = require('../app/config');
      
      watchConfig();
      const watcherCallback = fs.watchFile.mock.calls[0][1];

      const updatedConfig = {
        ...mockConfigData,
        relays: ['wss://relay1.com', 'wss://relay2.com', 'wss://relay3.com']
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(updatedConfig));
      watcherCallback();

      const result = getConfig();
      expect(result.relays).toHaveLength(3);
    });
  });
});