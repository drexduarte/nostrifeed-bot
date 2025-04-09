const { normalizeLink, delay } = require('../utils');

describe('normalizeLink', () => {
  it('removes query parameters from URL', () => {
    const original = 'https://example.com/news?id=123&utm_source=feed';
    const expected = 'https://example.com/news';
    expect(normalizeLink(original)).toBe(expected);
  });

  it('returns the same string if not a valid URL', () => {
    const input = 'not-a-url';
    expect(normalizeLink(input)).toBe(input);
  });
});

describe('delay', () => {
  it('resolves after the specified duration', async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });
});