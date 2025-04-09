jest.mock('fs', () => {
  let data = { links: [] };

  return {
    __setMockData: (mockData) => {
      data = mockData;
    },
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(() => JSON.stringify(data)),
    writeFileSync: jest.fn((_, content) => {
      data = JSON.parse(content);
    })
  };
});

const fs = require('fs');
const store = require('../store');

describe('store.js', () => {
  beforeEach(() => {
    fs.__setMockData({ links: [] });
    fs.existsSync.mockReturnValue(true);
  });

  it('gets published links', () => {
    expect(store.getPublishedLinks()).toEqual([]);
  });

  it('adds a new link and saves it', () => {
    store.addPublishedLink('https://another.com', 500);
    const links = store.getPublishedLinks();
    expect(links).toContain('https://another.com');
  });

  it('truncates links if max limit is exceeded', () => {
    const longList = Array.from({ length: 600 }, (_, i) => `https://site${i}.com`);
    fs.readFileSync.mockReturnValueOnce(JSON.stringify({ links: longList }));

    jest.resetModules();
    const store2 = require('../store');

    store2.addPublishedLink('https://new.com', 500);
    const links = store2.getPublishedLinks();
    expect(links.length).toBeLessThanOrEqual(500);
  });

  it('still saves even if max is zero', () => {
    jest.resetModules();
    const store3 = require('../store');
    store3.addPublishedLink('https://zero.com', 0);
    const links = store3.getPublishedLinks();
    expect(links).toEqual(['https://zero.com']);
  });

  it('initializes with empty list if file does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    jest.resetModules();
    const store4 = require('../store');
    expect(store4.getPublishedLinks()).toEqual([]);
  });
});