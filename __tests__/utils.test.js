const {
  delay,
  normalizeLink,
  generateContentHash,
  slugify,
  truncateText,
  sanitizeHtml,
  isValidUrl,
  retryWithBackoff,
  extractDomain,
  formatTimestamp
} = require('../app/utils');

describe('Utils Module', () => {
  
  describe('delay()', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('normalizeLink()', () => {
    it('should remove query strings', () => {
      const url = 'https://example.com/article?utm_source=twitter';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should remove hash fragments', () => {
      const url = 'https://example.com/article#section-1';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should remove trailing slash', () => {
      const url = 'https://example.com/article/';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should convert http to https', () => {
      const url = 'http://example.com/article';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should remove www prefix', () => {
      const url = 'https://www.example.com/article';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should lowercase the URL', () => {
      const url = 'https://Example.COM/Article';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should handle complex URLs', () => {
      const url = 'HTTP://WWW.Example.COM/Article/?utm=test&ref=twitter#section';
      expect(normalizeLink(url)).toBe('https://example.com/article');
    });

    it('should return original string if invalid URL', () => {
      const invalid = 'not-a-url';
      expect(normalizeLink(invalid)).toBe('not-a-url');
    });
  });

  describe('generateContentHash()', () => {
    it('should generate consistent hash for same content', () => {
      const hash1 = generateContentHash('Title', 'https://example.com');
      const hash2 = generateContentHash('Title', 'https://example.com');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = generateContentHash('Title 1', 'https://example.com');
      const hash2 = generateContentHash('Title 2', 'https://example.com');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 16 character hash', () => {
      const hash = generateContentHash('Title', 'https://example.com');
      expect(hash).toHaveLength(16);
    });

    it('should handle normalized links', () => {
      const hash1 = generateContentHash('Title', 'https://example.com?utm=test');
      const hash2 = generateContentHash('Title', 'https://example.com');
      expect(hash1).toBe(hash2);
    });
  });

  describe('slugify()', () => {
    it('should convert to lowercase', () => {
      expect(slugify('Bitcoin Magazine')).toBe('bitcoin-magazine');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('New York Times')).toBe('new-york-times');
    });

    it('should remove accents', () => {
      expect(slugify('São Paulo')).toBe('sao-paulo');
    });

    it('should remove special characters', () => {
      expect(slugify('Test & Demo!')).toBe('test-demo');
    });

    it('should remove multiple consecutive hyphens', () => {
      expect(slugify('Test   -   Demo')).toBe('test-demo');
    });

    it('should trim whitespace', () => {
      expect(slugify('  test  ')).toBe('test');
    });

    it('should handle hashtagFriendly option', () => {
      expect(slugify('Bitcoin News', { hashtagFriendly: true })).toBe('bitcoinnews');
    });
  });

  describe('truncateText()', () => {
    it('should not truncate if text is shorter than maxLength', () => {
      const text = 'Short text';
      expect(truncateText(text, 100)).toBe('Short text');
    });

    it('should truncate at word boundary', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = truncateText(text, 20);
      expect(result).toBe('This is a very long...');
    });

    it('should default to 280 characters', () => {
      const text = 'a'.repeat(300);
      const result = truncateText(text);
      expect(result.length).toBeLessThanOrEqual(283); // 280 + '...'
    });

    it('should handle text without spaces', () => {
      const text = 'a'.repeat(50);
      const result = truncateText(text, 20);
      expect(result).toHaveLength(23); // 20 + '...'
    });
  });

  describe('sanitizeHtml()', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      expect(sanitizeHtml(html)).toBe('Hello World');
    });

    it('should decode HTML entities', () => {
      const html = 'AT&amp;T &lt;test&gt;';
      expect(sanitizeHtml(html)).toBe('AT&T <test>');
    });

    it('should handle mixed HTML and entities', () => {
      const html = '<p>Price: &pound;100</p>';
      expect(sanitizeHtml(html)).toBe('Price: £100');
    });
  });

  describe('isValidUrl()', () => {
    it('should validate http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should validate https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should reject invalid protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('retryWithBackoff()', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      const result = await retryWithBackoff(fn, { 
        maxRetries: 3, 
        initialDelay: 10 
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent fail'));
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10 })
      ).rejects.toThrow('persistent fail');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');
      
      const start = Date.now();
      await retryWithBackoff(fn, { 
        maxRetries: 3, 
        initialDelay: 50,
        factor: 2
      });
      const duration = Date.now() - start;
      
      // Should wait 50ms + 100ms = 150ms minimum
      expect(duration).toBeGreaterThanOrEqual(140);
    });
  });

  describe('extractDomain()', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
    });

    it('should remove www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    it('should handle subdomains', () => {
      expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBeNull();
    });
  });

  describe('formatTimestamp()', () => {
    it('should format Unix timestamp correctly', () => {
      const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2024-01-01 00:00:00');
    });

    it('should handle current timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      const formatted = formatTimestamp(now);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });
});