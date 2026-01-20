const { FilterEngine, shouldFilterItem } = require('../app/filters');

describe('Filters Module', () => {
  
  describe('FilterEngine - exclude keywords', () => {
    it('should filter items with excluded keywords in title', () => {
      const engine = new FilterEngine({
        exclude_keywords: ['sports', 'soccer']
      });
      
      const item = {
        title: 'Latest soccer news from Premier League',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toBe('excluded keyword in title');
    });

    it('should filter items with excluded keywords in description', () => {
      const engine = new FilterEngine({
        exclude_keywords: ['politics']
      });
      
      const item = {
        title: 'Breaking News',
        contentSnippet: 'This article discusses politics and elections...',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toBe('excluded keyword in description');
    });

    it('should filter items with excluded keywords in categories', () => {
      const engine = new FilterEngine({
        exclude_keywords: ['entertainment']
      });
      
      const item = {
        title: 'Celebrity news',
        categories: ['entertainment', 'lifestyle'],
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.reason).toContain('excluded keyword in category');
    });

    it('should be case insensitive', () => {
      const engine = new FilterEngine({
        exclude_keywords: ['bitcoin']
      });
      
      const item = {
        title: 'BITCOIN price surge',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
    });
  });

  describe('FilterEngine - include keywords (whitelist)', () => {
    it('should allow items with required keywords', () => {
      const engine = new FilterEngine({
        include_keywords: ['bitcoin', 'crypto']
      });
      
      const item = {
        title: 'Bitcoin reaches new high',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });

    it('should filter items without required keywords', () => {
      const engine = new FilterEngine({
        include_keywords: ['bitcoin', 'crypto']
      });
      
      const item = {
        title: 'Stock market update',
        contentSnippet: 'Markets are up today',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toBe('does not match required keywords');
    });

    it('should check description if not in title', () => {
      const engine = new FilterEngine({
        include_keywords: ['blockchain']
      });
      
      const item = {
        title: 'Technology News',
        contentSnippet: 'New blockchain technology emerges...',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });
  });

  describe('FilterEngine - categories', () => {
    it('should filter excluded categories', () => {
      const engine = new FilterEngine({
        exclude_categories: ['sports', 'entertainment']
      });
      
      const item = {
        title: 'News Article',
        categories: ['sports'],
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toContain('excluded category');
    });

    it('should require whitelisted categories', () => {
      const engine = new FilterEngine({
        include_categories: ['technology', 'business']
      });
      
      const item = {
        title: 'News Article',
        categories: ['lifestyle'],
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toBe('category not in whitelist');
    });

    it('should allow whitelisted categories', () => {
      const engine = new FilterEngine({
        include_categories: ['technology']
      });
      
      const item = {
        title: 'Tech News - Testing Filter',
        categories: ['technology'],
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });

    it('should handle category objects', () => {
      const engine = new FilterEngine({
        exclude_categories: ['sports']
      });
      
      const item = {
        title: 'Sports Article',
        categories: [{ value: 'sports' }, { _: 'news' }],
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toBe('excluded category: sports');
    });
  });

  describe('FilterEngine - domains', () => {
    it('should filter excluded domains', () => {
      const engine = new FilterEngine({
        exclude_domains: ['spam-site.com', 'bad-news.com']
      });
      
      const item = {
        title: 'Article',
        link: 'https://spam-site.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toContain('excluded domain');
    });

    it('should handle www prefix', () => {
      const engine = new FilterEngine({
        exclude_domains: ['example.com']
      });
      
      const item = {
        title: 'Domain Article',
        link: 'https://www.example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toContain('excluded domain');
    });

    it('should allow non-excluded domains', () => {
      const engine = new FilterEngine({
        exclude_domains: ['bad-site.com']
      });
      
      const item = {
        title: 'Good Article',
        link: 'https://good-site.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });
  });

  describe('FilterEngine - title length', () => {
    it('should filter titles that are too short', () => {
      const engine = new FilterEngine({
        min_title_length: 20
      });
      
      const item = {
        title: 'Short',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toContain('title too short');
    });

    it('should filter titles that are too long', () => {
      const engine = new FilterEngine({
        max_title_length: 50
      });
      
      const item = {
        title: 'a'.repeat(100),
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toContain('title too long');
    });

    it('should allow titles within range', () => {
      const engine = new FilterEngine({
        min_title_length: 10,
        max_title_length: 100
      });
      
      const item = {
        title: 'This is a perfectly sized title',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });
  });

  describe('FilterEngine - date filter', () => {
    it('should filter old articles', () => {
      const engine = new FilterEngine({
        date_filter: { max_age_hours: 24 }
      });
      
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const item = {
        title: 'Old Article',
        pubDate: twoDaysAgo.toISOString(),
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toContain('too old');
    });

    it('should allow recent articles', () => {
      const engine = new FilterEngine({
        date_filter: { max_age_hours: 24 }
      });
      
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const item = {
        title: 'Recent Article',
        pubDate: oneHourAgo.toISOString(),
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });

    it('should allow items without date', () => {
      const engine = new FilterEngine({
        date_filter: { max_age_hours: 24 }
      });
      
      const item = {
        title: 'Article without date',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });
  });

  describe('shouldFilterItem (legacy function)', () => {
    it('should work as wrapper for FilterEngine', () => {
      const filters = {
        exclude_keywords: ['sports']
      };
      
      const item = {
        title: 'Sports news today',
        link: 'https://example.com/article'
      };
      
      expect(shouldFilterItem(item, filters)).toBe(true);
    });

    it('should return false when no filters match', () => {
      const filters = {
        exclude_keywords: ['politics']
      };
      
      const item = {
        title: 'Technology news',
        link: 'https://example.com/article'
      };
      
      expect(shouldFilterItem(item, filters)).toBe(false);
    });
  });

  describe('FilterEngine - complex scenarios', () => {
    it('should apply all filters in sequence', () => {
      const engine = new FilterEngine({
        exclude_keywords: ['politics'],
        include_keywords: ['technology'],
        min_title_length: 15
      });
      
      const item = {
        title: 'Tech', // Too short AND missing required keyword
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
    });

    it('should stop at first matching filter', () => {
      const engine = new FilterEngine({
        exclude_keywords: ['sports'],
        min_title_length: 100
      });
      
      const item = {
        title: 'Sports news', // Matches exclude_keywords
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(true);
      expect(result.reason).toBe('excluded keyword in title');
      // Should not reach title length check
    });

    it('should handle empty filter config', () => {
      const engine = new FilterEngine({});
      
      const item = {
        title: 'Any article',
        link: 'https://example.com/article'
      };
      
      const result = engine.shouldFilter(item);
      expect(result.filtered).toBe(false);
    });
  });
});