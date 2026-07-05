# BCV Rates

A small Node.js app that scrapes the current currency exchange rates from the
[Banco Central de Venezuela](https://www.bcv.org.ve/), serves them as a website
and exposes them via a JSON API. Rates are kept **in memory** and refreshed
**lazily**: when a visitor arrives and the cached rates are older than one hour
(or missing), the app re-scrapes before responding.

## Requirements

Node.js **20 or newer** (a transitive dependency needs the `File` global added
in Node 20). An `.nvmrc` is included — run `nvm use` if you use nvm.

## Run

```bash
nvm use        # optional, selects Node 22
npm install
npm start
```

Then open http://localhost:3000/ or query the API.

### Environment variables

| Variable          | Default              | Purpose                                                        |
| ----------------- | -------------------- | -------------------------------------------------------------- |
| `PORT`            | `3000`               | Port to listen on.                                             |
| `PUBLIC_BASE_URL` | (the requesting host)| Domain shown in the API example on the front page, e.g. `https://tasas.example.com`. |
| `MADE_BY_NAME`    | `Avila Systems`      | Name in the "Made by" credit.                                  |
| `MADE_BY_URL`     | (none — plain text)  | Link target for the "Made by" credit.                          |

Example:

```bash
PUBLIC_BASE_URL=https://tasas.example.com \
MADE_BY_URL=https://avilasystems.example \
npm start
```

## API

### `GET /api/rates`

```json
{
  "rates": { "USD": 36.12, "EUR": 39.44, "CNY": 5.01, "TRY": 1.05, "RUB": 0.39 },
  "referenceDate": "2026-07-05T00:00:00-04:00",
  "fetchedAt": "2026-07-05T14:03:21.000Z",
  "ageSeconds": 12,
  "stale": false
}
```

- `stale: true` means the last scrape failed and the app is serving the previous
  (older than one hour) cached values so the site stays up.
- Returns `502` only if no rates could ever be fetched.

### `GET /health`

```json
{ "ok": true }
```

## How it works

- `src/scraper.js` — fetches the BCV homepage and parses the rate `<strong>`
  values out of the `#dolar`, `#euro`, `#yuan`, `#lira`, `#rublo` elements.
  TLS verification is relaxed **only for the BCV request** because that site
  ships an incomplete certificate chain.
- `src/cache.js` — in-memory store with the 1-hour lazy-refresh logic and
  concurrent-refresh de-duplication.
- `src/server.js` — Express app serving the API and the static site.
- `public/index.html` — the front-end, which reads from `/api/rates`.

Rates reset on restart and are repopulated on the first visit.
