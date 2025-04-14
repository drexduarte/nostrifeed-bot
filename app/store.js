const fs = require('fs');
const path = require('path');

const PUBLISHED_FILE = path.resolve('published.json');
let publishedLinks = [];

try{
  if (fs.existsSync(PUBLISHED_FILE)) {
    const data = JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf-8'));
    publishedLinks = Array.isArray(data.links) ? data.links : [];
  } else {
    publishedLinks = [];
  }
} catch(err){
  publishedLinks = [];
}


function save() {
  fs.writeFileSync(PUBLISHED_FILE, JSON.stringify({ links: publishedLinks }, null, 2));
}

function getPublishedLinks() {
  return publishedLinks;
}

function wasPublished(link) {
  return publishedLinks.some(entry => entry.url === link);
}

function addPublishedLink(link, max = 500, category = '') {
  publishedLinks.push({ url: link, category });
  if (max > 0 && publishedLinks.length > max) {
    publishedLinks = publishedLinks.slice(-max);
  }
  save();
}

function fetchLatestNews(category = '', limit = 5) {
  const filtered = category
    ? publishedLinks.filter(entry => entry.category?.toLowerCase() === category.toLowerCase())
    : publishedLinks;

  return filtered.slice(-limit).reverse().map(entry => entry.url);
}

module.exports = { getPublishedLinks, wasPublished, addPublishedLink, fetchLatestNews }