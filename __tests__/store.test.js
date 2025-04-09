jest.mock('fs', () => {
  let data = { links: [] };

  return {
    __setMockData: (mockData) => {
      data = mockData;
    },
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => JSON.stringify(data)),
    writeFileSync: jest.fn((_, content) => {
      data = JSON.parse(content);
    })
  };
});

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
});