# BCV Rates

A small Node.js app that scrapes the currency exchange rates from the
[Banco Central de Venezuela](https://www.bcv.org.ve/), serves them as a website
and exposes them via a JSON API.

## Fecha valor (why there are two rates)

The BCV publishes the **next day's** rate around 3–4 p.m. Venezuela time, but the
rate that stays **in effect** is the previous one until midnight. The **fecha
valor** is the exact day a rate becomes effective. Because the BCV homepage only
ever shows one rate at a time, the app **remembers** recent snapshots (keyed by
fecha valor) in an external store, so it can always show:

- the **currently effective** rate (fecha valor = today, Venezuela time) as the
  main table, and
- the **next day's** rate (once published) in a smaller table beside it.

At midnight (Venezuela time) the next-day rate becomes the main one automatically
— this is computed from the date, not from a new scrape.

Rates are refreshed by a **Vercel Cron** job that hits `/api/refresh`; the store
(Upstash Redis) doubles as a shared cache across serverless invocations. Locally,
if no Redis credentials are present, the app falls back to an in-memory store and
scrapes lazily on first visit.

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
| `PORT`            | `3000`               | Port to listen on (local only).                                |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | (in-memory fallback) | Upstash Redis credentials (the Vercel Redis integration sets these; `KV_REST_API_URL` / `KV_REST_API_TOKEN` are also accepted). Without them the app uses an in-memory store. |
| `CRON_SECRET`     | (endpoint open)      | Shared secret protecting `/api/refresh`. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`. If unset, the endpoint is open (fine for local dev). |
| `PUBLIC_BASE_URL` | (the requesting host)| Domain shown in the API example on the front page, e.g. `https://tasas.example.com`. |
| `MADE_BY_NAME`    | `Avila Systems`      | Name in the "Made by" credit.                                  |
| `MADE_BY_URL`     | (none — plain text)  | Link target for the "Made by" credit.                          |

## Deploy on Vercel

The app runs as a serverless function. `vercel.json` routes all requests to the
Express app (`api/index.js`) and defines a daily cron that refreshes the rates:

```json
"crons": [{ "path": "/api/refresh", "schedule": "0 22 * * *" }]
```

`0 22 * * *` is 22:00 UTC = 6 p.m. Venezuela, **after** the BCV publishes the next
day's rate. One daily run is enough (and is all the Vercel **Hobby** plan allows);
the midnight switch is date-based, not scrape-based. On the **Pro** plan you can
add more frequent afternoon runs for extra tolerance.

Setup steps:

1. Add a **Redis** store from the Vercel Marketplace (Upstash) and link it to the
   project — it sets the Redis env vars automatically.
2. Set `CRON_SECRET` in the project's environment variables.
3. Deploy. For local development against real Redis, run `vercel env pull`.

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
  "current": {
    "rates": { "USD": 36.12, "EUR": 39.44, "CNY": 5.01, "TRY": 1.05, "RUB": 0.39 },
    "fechaValor": "2026-07-08",
    "referenceDate": "2026-07-08T00:00:00-04:00"
  },
  "next": {
    "rates": { "USD": 36.30, "EUR": 39.60, "CNY": 5.02, "TRY": 1.06, "RUB": 0.40 },
    "fechaValor": "2026-07-09",
    "referenceDate": "2026-07-09T00:00:00-04:00"
  },
  "rates": { "USD": 36.12, "EUR": 39.44, "CNY": 5.01, "TRY": 1.05, "RUB": 0.39 },
  "referenceDate": "2026-07-08T00:00:00-04:00",
  "scrapedAt": "2026-07-08T14:03:21.000Z",
  "stale": false
}
```

- `current` is the rate **in effect today** (fecha valor ≤ today, Venezuela time).
- `next` is the next day's published rate, or `null` if not published yet.
- Top-level `rates` / `referenceDate` mirror `current` for backward compatibility.
- `stale: true` means today's effective rate isn't available yet, so `current`
  holds the most recent published rate instead.
- Returns `502` only if no rates could ever be fetched.

### `GET /api/refresh`

Scrapes the BCV and stores the snapshot. Meant for the Vercel Cron job; protected
by `CRON_SECRET` (see env vars).

### `GET /health`

```json
{ "ok": true }
```

## How it works

- `src/scraper.js` — fetches the BCV homepage and parses the rate `<strong>`
  values out of the `#dolar`, `#euro`, `#yuan`, `#lira`, `#rublo` elements, plus
  the **fecha valor** (normalized to `YYYY-MM-DD`). TLS verification is relaxed
  **only for the BCV request** because that site ships an incomplete cert chain.
- `src/time.js` — Venezuela-time helpers (`America/Caracas`): today's date and
  fecha-valor normalization.
- `src/store.js` — persists recent snapshots keyed by fecha valor in Upstash
  Redis (in-memory fallback when no credentials), pruned to the last few days.
- `src/cache.js` — `refreshRates()` scrapes + stores; `getRates()` reads the
  store and picks the effective (`current`) and next-day (`next`) rates by date.
- `src/server.js` — Express app (exported for serverless) serving the API,
  `/api/refresh`, and the static site.
- `api/index.js` + `vercel.json` — Vercel serverless entry, routing, and cron.
- `public/index.html` — the front-end, which reads from `/api/rates`.
