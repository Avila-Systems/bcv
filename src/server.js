import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getRates, refreshRates } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

app.get('/api/rates', async (req, res) => {
  try {
    const data = await getRates();
    res.json(data);
  } catch (err) {
    const status = err.statusCode || 502;
    res.status(status).json({ error: 'Failed to fetch BCV rates', detail: String(err.message || err) });
  }
});

// Disparado por Vercel Cron para scrapear y guardar la tasa del día.
// Se protege con CRON_SECRET: Vercel envía "Authorization: Bearer <CRON_SECRET>".
// Si CRON_SECRET no está definido, el endpoint queda abierto (útil en local).
app.get('/api/refresh', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const snapshot = await refreshRates();
    res.json({ ok: true, fechaValor: snapshot.fechaValor, scrapedAt: snapshot.scrapedAt });
  } catch (err) {
    res.status(502).json({ error: 'Refresh failed', detail: String(err.message || err) });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Front-end configuration (domain shown in the API example + "made by" link).
// Values come from environment variables; the API base falls back to the
// requesting host so the example is always accurate even when unset.
app.get('/api/config', (req, res) => {
  const fallbackBase = `${req.protocol}://${req.get('host')}`;
  res.json({
    apiBaseUrl: (process.env.PUBLIC_BASE_URL || fallbackBase).replace(/\/+$/, ''),
    madeByName: process.env.MADE_BY_NAME || 'Avila Systems',
    madeByUrl: process.env.MADE_BY_URL || '',
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// En Vercel la app se usa como handler serverless (api/index.js), sin listen.
// En local (o cualquier entorno que no sea Vercel) arrancamos el servidor.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BCV rates server listening on http://localhost:${PORT}`);
  });
}

export default app;
