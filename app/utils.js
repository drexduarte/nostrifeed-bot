const crypto = require('crypto');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normaliza URLs removendo query strings, fragmentos e variações comuns
 */
function normalizeLink(link) {
  try {
    const url = new URL(link);
    
    // Remove query strings e fragmentos
    url.search = '';
    url.hash = '';
    
    // Remove trailing slash
    let pathname = url.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;
    
    // Normaliza protocolo para https
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
    }
    
    // Remove www. do hostname
    url.hostname = url.hostname.replace(/^www\./, '');
    
    return url.toString().toLowerCase();
  } catch {
    return link;
  }
}

/**
 * Gera hash único para conteúdo (usado como backup para detecção de duplicatas)
 */
function generateContentHash(title, link) {
  const content = `${title}|${normalizeLink(link)}`;
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function slugify(text, options = {}) {
  let slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  if (options.hashtagFriendly) {
    slug = slug.replace(/-/g, '');
  }

  return slug;
}

/**
 * Trunca texto para um tamanho máximo mantendo palavras inteiras
 */
function truncateText(text, maxLength = 280) {
  if (text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 
    ? truncated.slice(0, lastSpace) + '...'
    : truncated + '...';
}

/**
 * Sanitiza texto HTML removendo tags e decodificando entidades
 */
function sanitizeHtml(html) {
  const he = require('he');
  return he.decode(html.replace(/<[^>]*>/g, ''));
}

/**
 * Valida se uma URL é válida e acessível
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Retry com backoff exponencial
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2
  } = options;

  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      if (i < maxRetries - 1) {
        const delayMs = Math.min(initialDelay * Math.pow(factor, i), maxDelay);
        console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
        await delay(delayMs);
      }
    }
  }
  
  throw lastError;
}

/**
 * Extrai domínio de uma URL
 */
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Formata timestamp para exibição
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

async function delayWithJitter(baseMs, jitterPercent = 30) {
  const maxVariation = (baseMs * jitterPercent) / 100;
  const jitter = (Math.random() * 2 - 1) * maxVariation;
  const finalDelay = Math.max(100, Math.floor(baseMs + jitter));
  
  console.log(`⏱️  Waiting ${(finalDelay / 1000).toFixed(2)}s (base: ${(baseMs / 1000).toFixed(2)}s, jitter: ${jitterPercent}%)`);
  
  return delay(finalDelay);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  delay,
  delayWithJitter,
  normalizeLink,
  generateContentHash,
  slugify,
  truncateText,
  sanitizeHtml,
  isValidUrl,
  retryWithBackoff,
  extractDomain,
  formatTimestamp,
  randomBetween
};