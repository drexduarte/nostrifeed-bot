function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeLink(link) {
  try {
    const url = new URL(link);
    url.search = '';
    return url.toString();
  } catch {
    return link;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}


module.exports = { delay, normalizeLink, slugify };