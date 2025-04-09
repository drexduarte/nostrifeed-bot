const fs = require('fs');
const PUBLISHED_FILE = 'published.json';

let publishedLinks = { links: [] };
if (fs.existsSync(PUBLISHED_FILE)) {
  publishedLinks = JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf-8'));
}

function getPublishedLinks() {
  return publishedLinks.links;
}

function addPublishedLink(link, max = 500) {
  publishedLinks.links.push(link);
  if (publishedLinks.links.length > max) {
    publishedLinks.links = publishedLinks.links.slice(-max);
  }
  fs.writeFileSync(PUBLISHED_FILE, JSON.stringify(publishedLinks, null, 2));
}

module.exports = { getPublishedLinks, addPublishedLink };