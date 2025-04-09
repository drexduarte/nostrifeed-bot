function shouldFilterItem(item, filters = {}) {
  const title = (item.title || '').toLowerCase();
  const categories = (item.categories || [])
    .filter(c => typeof c === 'string')
    .map(c => c.toLowerCase());

  if (filters.exclude_keywords) {
    for (const keyword of filters.exclude_keywords) {
      const kw = keyword.toLowerCase();
      if (title.includes(kw)) return true;
      if (categories.some(cat => cat.includes(kw))) return true;
    }
  }

  return false;
}

module.exports = { shouldFilterItem };