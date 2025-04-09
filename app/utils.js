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

module.exports = { delay, normalizeLink };