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
    store.addPublishedLink('https://example.com', 500, 'economy');
    const links = store.getPublishedLinks();
    expect(links).toContainEqual({ url: 'https://example.com', category: 'economy' });
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

  it('should handle when file does not contain a valid list', () => {
    jest.resetModules();
  
    const fs = require('fs'); 
    fs.__setMockData({});
  
    const store = require('../app/store');
    const links = store.getPublishedLinks();
  
    expect(links).toEqual([]);
  });
});