function shouldFilterItem(item, filters) {
  const title = (item.title || '').toLowerCase();
  const categories = (item.categories || []).map(cat => {
    if (typeof cat === 'string') return cat.toLowerCase();
    if (typeof cat === 'object') return (cat.value || cat._ || '').toLowerCase();
    return '';
  });

  const keywords = (filters.exclude_keywords || []).map(k => k.toLowerCase());

  for (const word of keywords) {
    if (title.includes(word)) return true;
    if (categories.some(cat => cat.includes(word))) return true;
  }

  return false;
}

module.exports = { shouldFilterItem };