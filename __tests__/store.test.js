jest.mock('fs');

const fs = require('fs');
const store = require('../app/store');

describe('store.js', () => {
  beforeEach(() => {
    fs.__setMockData({ links: [] });
  });

  it('gets published links', () => {
    expect(store.getPublishedLinks()).toEqual([]);
  });

  it('adds a new link with category and saves it', () => {
    store.addPublishedLink('https://example.com', 500, 'economy', 'exampleFeed');
    const links = store.getPublishedLinks();
    expect(links).toContainEqual({ url: 'https://example.com', category: 'economy', feed: 'exampleFeed' });
  });

  it('wasPublished returns true if the link was saved', () => {
    store.addPublishedLink('https://exists.com', 500, 'tech');
    expect(store.wasPublished('https://exists.com')).toBe(true);
  });

  it('wasPublished returns false if the link was not saved', () => {
    expect(store.wasPublished('https://not-found.com')).toBe(false);
  });

  it('fetchLatestNews returns latest N links for category', () => {
    store.addPublishedLink('https://e1.com', 500, 'economy');
    store.addPublishedLink('https://e2.com', 500, 'economy');
    store.addPublishedLink('https://e3.com', 500, 'economy');
    const latest = store.fetchLatestNews('economy', 2);
    expect(latest).toEqual(['https://e3.com', 'https://e2.com']);
  });

  it('fetchLatestNews returns latest N links for specific feed', () => {
    store.addPublishedLink('https://p1.com', 500, 'politics', 'politicsFeed');
    store.addPublishedLink('https://p2.com', 500, 'politics', 'politicsFeed');
    store.addPublishedLink('https://p3.com', 500, 'politics', 'politicsFeed');
    const latest = store.fetchLatestNews('politicsFeed', 2, true);
    expect(latest).toEqual(['https://p3.com', 'https://p2.com']);
  });

  it('fetchLatestNews returns latest N links from all categories', () => {
    store.addPublishedLink('https://a.com', 500, 'a');
    store.addPublishedLink('https://b.com', 500, 'b');
    const latest = store.fetchLatestNews('', 1);
    expect(latest).toEqual(['https://b.com']);
  });

  it('truncates links if max limit is exceeded', () => {
    const longList = Array.from({ length: 600 }, (_, i) => ({
      url: `https://site${i}.com`,
      category: 'overflow'
    }));
  
    jest.resetModules();
    const fs = require('fs'); 
    fs.__setMockData({ links: longList });

    const store2 = require('../app/store');
    store2.addPublishedLink('https://new.com', 500, 'overflow');
    const links = store2.getPublishedLinks();
    expect(links.length).toBeLessThanOrEqual(500);
    expect(links.at(-1).url).toBe('https://new.com');
  });

  it('should handle when file does not exist', () => {
    jest.resetModules();
    const fs = require('fs'); 
    fs.existsSync.mockReturnValueOnce(false);

    const store = require('../app/store');
    const links = store.getPublishedLinks();
    expect(links).toEqual([]);
  });

  it('should handle when file contains an invalid list (not an array)', () => {
    jest.resetModules();
    const fs = require('fs'); 
    fs.__setMockData({ links: 'invalid data' });

    const store = require('../app/store');
    const links = store.getPublishedLinks();
    expect(links).toEqual([]);
  });

  it('should handle when file contains an invalid list (missing links)', () => {
    jest.resetModules();
    const fs = require('fs'); 
    fs.__setMockData({ someOtherKey: 'value' });

    const store = require('../app/store');
    const links = store.getPublishedLinks();
    expect(links).toEqual([]);
  });

  it('should handle reading a valid file and loading links correctly', () => {
    jest.resetModules();
    const mockLinks = [
      { url: 'https://site1.com', category: 'tech' },
      { url: 'https://site2.com', category: 'economy' }
    ];
    const fs = require('fs'); 
    fs.__setMockData({ links: mockLinks });

    const store = require('../app/store');
    const links = store.getPublishedLinks();
    expect(links).toEqual(mockLinks);
  });

  it('should handle file read errors gracefully', () => {
    jest.resetModules();
    const fs = require('fs');
    fs.readFileSync.mockImplementationOnce(() => {
      throw new Error('File read error');
    });

    const store = require('../app/store');
    const links = store.getPublishedLinks();
    expect(links).toEqual([]);
  });

  it('should handle errors when JSON parsing fails', () => {
    jest.resetModules();
    const fs = require('fs');
    fs.readFileSync.mockReturnValueOnce('invalid json');

    const store = require('../app/store');
    const links = store.getPublishedLinks();
    expect(links).toEqual([]);
  });
});