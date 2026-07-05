import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getRates } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

app.get('/api/rates', async (req, res) => {
  try {
    const data = await getRates();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch BCV rates', detail: String(err.message || err) });
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

app.listen(PORT, () => {
  console.log(`BCV rates server listening on http://localhost:${PORT}`);
});
