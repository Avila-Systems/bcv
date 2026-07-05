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

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`BCV rates server listening on http://localhost:${PORT}`);
});
