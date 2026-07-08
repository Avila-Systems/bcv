import { scrapeRates } from './scraper.js';
import { getStore, upsert } from './store.js';
import { caracasDate } from './time.js';

let inFlight = null; // dedupe de scrapes concurrentes

// Scrapea el BCV y guarda el snapshot en el almacén, indexado por fecha valor.
// La usa el endpoint /api/refresh (disparado por Vercel Cron).
export async function refreshRates() {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const snapshot = await scrapeRates();
    // Si no se pudo parsear la fecha valor del BCV, asumimos el día VE actual.
    if (!snapshot.fechaValor) snapshot.fechaValor = caracasDate();
    await upsert(snapshot);
    return snapshot;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

// Elige la tasa VIGENTE (fecha valor <= hoy) y la SIGUIENTE (fecha valor > hoy).
function pick(snapshots, today) {
  const dates = Object.keys(snapshots).sort(); // YYYY-MM-DD => orden cronológico
  if (dates.length === 0) return { current: null, next: null };

  // Vigente: la mayor fecha valor que no supere hoy.
  let currentDate = null;
  for (const d of dates) {
    if (d <= today) currentDate = d;
  }

  let nextDate = null;
  if (currentDate) {
    // Solo mostramos "siguiente" cuando ya tenemos una vigente real.
    nextDate = dates.find((d) => d > today) || null;
  } else {
    // Solo hay fechas futuras (arranque en frío tras la publicación de las 3pm
    // sin historial previo): mostramos la más antigua disponible como vigente.
    currentDate = dates[0];
  }

  return {
    current: snapshots[currentDate] || null,
    next: nextDate ? snapshots[nextDate] : null,
  };
}

function shapeSnapshot(s) {
  return { rates: s.rates, fechaValor: s.fechaValor, referenceDate: s.referenceDate };
}

// Lee del almacén y devuelve la tasa vigente + la del día siguiente (si existe).
export async function getRates() {
  let snapshots = await getStore();

  // Salvaguarda: si el almacén está vacío, intenta poblarlo en el acto.
  if (Object.keys(snapshots).length === 0) {
    await refreshRates();
    snapshots = await getStore();
  }

  const today = caracasDate();
  const { current, next } = pick(snapshots, today);

  if (!current) {
    const err = new Error('No hay tasas disponibles');
    err.statusCode = 502;
    throw err;
  }

  return {
    current: shapeSnapshot(current),
    next: next ? shapeSnapshot(next) : null,
    // Retrocompatibilidad con el contrato previo del API.
    rates: current.rates,
    referenceDate: current.referenceDate,
    scrapedAt: current.scrapedAt,
    // true cuando aún no tenemos la tasa vigente de hoy (mostramos una futura).
    stale: current.fechaValor > today,
  };
}
