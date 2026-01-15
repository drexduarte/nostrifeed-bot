const fs = require('fs');
const path = require('path');

const PUBLISHED_FILE = path.resolve('published.json');
const RESPONDED_EVENTS_FILE = path.resolve('responded_events.json');

let publishedLinks = [];
let respondedEvents = new Map();

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

try{
  if (fs.existsSync(RESPONDED_EVENTS_FILE)) {
    const data = JSON.parse(fs.readFileSync(RESPONDED_EVENTS_FILE, 'utf-8'));
    respondedEvents = new Map(Array.isArray(data.events) ? data.events : []);
  } else {
    respondedEvents = new Map();
  }
} catch(err){
  respondedEvents = new Map();
}


function save() {
  fs.writeFileSync(PUBLISHED_FILE, JSON.stringify({ links: publishedLinks }, null, 2));
}

function saveRespondedEvents() {
  fs.writeFileSync(RESPONDED_EVENTS_FILE, JSON.stringify({ events: Array.from(respondedEvents.entries()) }, null, 2));
}

function addRespondedEvent(eventId) {
  respondedEvents.set(eventId, Date.now() / 1000);
  for(const [id, timestamp] of respondedEvents) {
    if((Date.now() / 1000) - timestamp > 3600) { // remove eventos com mais de 1 hora
      respondedEvents.delete(id);
    }
  }
  saveRespondedEvents();
}

function getPublishedLinks() {
  return publishedLinks;
}

function wasResponded(eventId) {
  return respondedEvents.has(eventId);
}

function wasPublished(link) {
  return publishedLinks.some(entry => entry.url === link);
}

function addPublishedLink(link, max = 500, category = '', feed = '') {
  publishedLinks.push({ url: link, category, feed });
  if (max > 0 && publishedLinks.length > max) {
    publishedLinks = publishedLinks.slice(-max);
  }
  save();
}

function fetchLatestNews(category = '', limit = 5, feed = false) {
  const filtered = category
    ? publishedLinks.filter(entry => feed ?
        entry.feed?.toLowerCase() === category.toLowerCase() :
      entry.category?.toLowerCase() === category.toLowerCase())
    : publishedLinks;

  return filtered.slice(-limit).reverse().map(entry => entry.url);
}

module.exports = { getPublishedLinks, wasPublished, addPublishedLink, fetchLatestNews, addRespondedEvent, wasResponded }