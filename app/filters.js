/**
 * Sistema avançado de filtros para itens de RSS
 */

class FilterEngine {
  constructor(config = {}) {
    this.excludeKeywords = (config.exclude_keywords || []).map(k => k.toLowerCase());
    this.includeKeywords = (config.include_keywords || []).map(k => k.toLowerCase());
    this.excludeCategories = (config.exclude_categories || []).map(c => c.toLowerCase());
    this.includeCategories = (config.include_categories || []).map(c => c.toLowerCase());
    this.excludeDomains = (config.exclude_domains || []).map(d => d.toLowerCase());
    this.minTitleLength = config.min_title_length || 10;
    this.maxTitleLength = config.max_title_length || 500;
    this.dateFilter = config.date_filter || null; // { max_age_hours: 24 }
  }

  /**
   * Normaliza categorias do item
   */
  extractCategories(item) {
    if (!item.categories) return [];
    
    return item.categories.map(cat => {
      if (typeof cat === 'string') return cat.toLowerCase();
      if (typeof cat === 'object') return (cat.value || cat._ || '').toLowerCase();
      return '';
    }).filter(Boolean);
  }

  /**
   * Extrai domínio da URL
   */
  extractDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Verifica se o texto contém alguma palavra-chave
   */
  containsKeyword(text, keywords) {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Filtra por palavras-chave excludentes
   */
  checkExcludeKeywords(item) {
    if (this.excludeKeywords.length === 0) return false;
    
    const title = (item.title || '').toLowerCase();
    const description = (item.contentSnippet || item.content || '').toLowerCase();
    const categories = this.extractCategories(item);
    
    // Verifica no título
    if (this.containsKeyword(title, this.excludeKeywords)) {
      return { filtered: true, reason: 'excluded keyword in title' };
    }
    
    // Verifica na descrição (apenas primeiras 200 chars)
    const shortDesc = description.slice(0, 200);
    if (this.containsKeyword(shortDesc, this.excludeKeywords)) {
      return { filtered: true, reason: 'excluded keyword in description' };
    }
    
    // Verifica nas categorias
    for (const category of categories) {
      if (this.excludeKeywords.some(kw => category.includes(kw))) {
        return { filtered: true, reason: `excluded keyword in category: ${category}` };
      }
    }
    
    return { filtered: false };
  }

  /**
   * Filtra por palavras-chave incluídas (whitelist)
   */
  checkIncludeKeywords(item) {
    if (this.includeKeywords.length === 0) return { filtered: false };
    
    const title = (item.title || '').toLowerCase();
    const description = (item.contentSnippet || item.content || '').toLowerCase();
    
    const hasIncludedKeyword = 
      this.containsKeyword(title, this.includeKeywords) ||
      this.containsKeyword(description.slice(0, 200), this.includeKeywords);
    
    if (!hasIncludedKeyword) {
      return { filtered: true, reason: 'does not match required keywords' };
    }
    
    return { filtered: false };
  }

  /**
   * Filtra por categorias
   */
  checkCategories(item) {
    const categories = this.extractCategories(item);
    
    // Verifica categorias excluídas
    if (this.excludeCategories.length > 0) {
      for (const category of categories) {
        if (this.excludeCategories.includes(category)) {
          return { filtered: true, reason: `excluded category: ${category}` };
        }
      }
    }
    
    // Verifica categorias incluídas (whitelist)
    if (this.includeCategories.length > 0) {
      const hasIncludedCategory = categories.some(cat => 
        this.includeCategories.includes(cat)
      );
      
      if (!hasIncludedCategory && categories.length > 0) {
        return { filtered: true, reason: 'category not in whitelist' };
      }
    }
    
    return { filtered: false };
  }

  /**
   * Filtra por domínio
   */
  checkDomain(item) {
    if (this.excludeDomains.length === 0) return { filtered: false };
    
    const domain = this.extractDomain(item.link);
    
    if (this.excludeDomains.includes(domain)) {
      return { filtered: true, reason: `excluded domain: ${domain}` };
    }
    
    return { filtered: false };
  }

  /**
   * Filtra por comprimento do título
   */
  checkTitleLength(item) {
    const title = (item.title || '').trim();
    
    if (title.length < this.minTitleLength) {
      return { filtered: true, reason: `title too short (${title.length} chars)` };
    }
    
    if (title.length > this.maxTitleLength) {
      return { filtered: true, reason: `title too long (${title.length} chars)` };
    }
    
    return { filtered: false };
  }

  /**
   * Filtra por data de publicação
   */
  checkDate(item) {
    if (!this.dateFilter || !this.dateFilter.max_age_hours) {
      return { filtered: false };
    }
    
    const pubDate = item.pubDate || item.isoDate;
    if (!pubDate) return { filtered: false }; // Se não tem data, não filtra
    
    const itemDate = new Date(pubDate);
    const now = new Date();
    const ageHours = (now - itemDate) / (1000 * 60 * 60);
    
    if (ageHours > this.dateFilter.max_age_hours) {
      return { filtered: true, reason: `too old (${ageHours.toFixed(1)} hours)` };
    }
    
    return { filtered: false };
  }

  /**
   * Aplica todos os filtros
   */
  shouldFilter(item) {
    const checks = [
      this.checkExcludeKeywords(item),
      this.checkIncludeKeywords(item),
      this.checkCategories(item),
      this.checkDomain(item),
      this.checkTitleLength(item),
      this.checkDate(item)
    ];
    
    for (const check of checks) {
      if (check.filtered) {
        return { filtered: true, reason: check.reason };
      }
    }
    
    return { filtered: false };
  }
}

/**
 * Função legada para compatibilidade
 */
function shouldFilterItem(item, filters) {
  const engine = new FilterEngine(filters);
  return engine.shouldFilter(item).filtered;
}

module.exports = {
  FilterEngine,
  shouldFilterItem
};