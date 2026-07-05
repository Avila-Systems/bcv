import https from 'node:https';
import axios from 'axios';
import * as cheerio from 'cheerio';

const BCV_URL = 'https://www.bcv.org.ve/';

// The BCV site ships an incomplete TLS certificate chain, so standard
// verification fails with "unable to verify the first certificate".
// We relax verification for THIS request only, via a scoped agent.
const bcvAgent = new https.Agent({ rejectUnauthorized: false });

// Element id on the BCV homepage -> ISO 4217 currency code.
const CURRENCY_IDS = {
  dolar: 'USD',
  euro: 'EUR',
  yuan: 'CNY',
  lira: 'TRY',
  rublo: 'RUB',
};

// BCV formats numbers as "36.123,45" (dot = thousands, comma = decimal).
function parseRate(raw) {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export async function scrapeRates() {
  const { data: html } = await axios.get(BCV_URL, {
    httpsAgent: bcvAgent,
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; bcv-rates/1.0; +https://www.bcv.org.ve/)',
    },
  });

  const $ = cheerio.load(html);
  const rates = {};

  for (const [id, code] of Object.entries(CURRENCY_IDS)) {
    const raw = $(`#${id} strong`).first().text();
    const value = parseRate(raw);
    if (value !== null) rates[code] = value;
  }

  if (Object.keys(rates).length === 0) {
    throw new Error('No exchange rates could be parsed from the BCV page');
  }

  // Reference date the rates are valid for (BCV publishes it near the rates).
  const dateAttr = $('.pull-right .date-display-single').attr('content');
  const dateText = $('.pull-right .date-display-single').first().text().trim();
  const referenceDate = dateAttr || dateText || null;

  return {
    rates,
    referenceDate,
    scrapedAt: new Date().toISOString(),
  };
}
