const { shouldFilterItem } = require('../app/filters');

describe('shouldFilterItem', () => {
  const filters = {
    exclude_keywords: ['futebol', 'celebrity']
  };

  it('filters by keyword in title', () => {
    const item = { title: 'Notícia sobre futebol', categories: [] };
    expect(shouldFilterItem(item, filters)).toBe(true);
  });

  it('filters by keyword in categories', () => {
    const item = { title: 'Economia em alta', categories: ['celebrity'] };
    expect(shouldFilterItem(item, filters)).toBe(true);
  });

  it('passes when no keywords match', () => {
    const item = { title: 'Mercado financeiro cresce', categories: ['economia'] };
    expect(shouldFilterItem(item, filters)).toBe(false);
  });

  it('passes when filters are empty', () => {
    const item = { title: 'General news', categories: [] };
    expect(shouldFilterItem(item, {})).toBe(false);
  });

  it('handles missing title and categories gracefully', () => {
    const item = {};
    expect(shouldFilterItem(item, filters)).toBe(false);
  });

  it('filters by object-based category with value field', () => {
    const item = { title: 'News headline', categories: [{ value: 'futebol' }] };
    const filters = { exclude_keywords: ['futebol'] };
    expect(shouldFilterItem(item, filters)).toBe(true);
  });

  it('filters by object-based category with _ field', () => {
    const item = { title: 'News headline', categories: [{ _: 'celebrity' }] };
    const filters = { exclude_keywords: ['celebrity'] };
    expect(shouldFilterItem(item, filters)).toBe(true);
  });

  it('handles category object without value or _', () => {
    const item = { title: 'News', categories: [{ unknown: 'none' }] };
    expect(shouldFilterItem(item, filters)).toBe(false);
  });
});