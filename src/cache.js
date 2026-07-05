import { scrapeRates } from './scraper.js';

const ONE_HOUR = 60 * 60 * 1000;

// In-memory store. Resets on restart; repopulated lazily on the first visit.
let cache = null; // { rates, referenceDate, scrapedAt, fetchedAtMs }
let inFlight = null; // dedupes concurrent refreshes into a single scrape

function isFresh() {
  return cache !== null && Date.now() - cache.fetchedAtMs < ONE_HOUR;
}

async function refresh() {
  // If a refresh is already running, join it instead of starting another.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const result = await scrapeRates();
    cache = { ...result, fetchedAtMs: Date.now() };
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

function shape(entry, stale) {
  return {
    rates: entry.rates,
    referenceDate: entry.referenceDate,
    fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
    ageSeconds: Math.round((Date.now() - entry.fetchedAtMs) / 1000),
    stale,
  };
}

// Lazy refresh: serve the cache when fresh, otherwise re-scrape.
// On scrape failure, fall back to stale cache if we have one.
export async function getRates() {
  if (isFresh()) return shape(cache, false);

  try {
    const entry = await refresh();
    return shape(entry, false);
  } catch (err) {
    if (cache) return shape(cache, true);
    throw err;
  }
}
