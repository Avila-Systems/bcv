// Persistencia de los últimos snapshots de tasas, indexados por fecha valor.
//
// En Vercel (serverless) el disco es efímero y el estado en memoria no se
// comparte entre invocaciones, así que usamos Upstash Redis (integración de
// Vercel) como almacén externo. Si no hay credenciales (desarrollo local),
// caemos a un almacén en memoria para que la app funcione sin configuración.

const KEY = 'bcv:snapshots';
const MAX_SNAPSHOTS = 5;

// La integración de Redis en Vercel expone las credenciales con prefijo
// UPSTASH_KV_REST_API_* (o KV_REST_API_* si vienes del antiguo Vercel KV).
const REDIS_URL =
  process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

const hasKV = Boolean(REDIS_URL && REDIS_TOKEN);

let memory = {}; // fallback: { "YYYY-MM-DD": snapshot }
let redisClient = null;

async function getRedis() {
  if (!redisClient) {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
  return redisClient;
}

// Devuelve el mapa de snapshots { "YYYY-MM-DD": { rates, fechaValor, ... } }.
export async function getStore() {
  if (hasKV) {
    const redis = await getRedis();
    return (await redis.get(KEY)) || {};
  }
  return memory;
}

async function saveStore(snapshots) {
  if (hasKV) {
    const redis = await getRedis();
    await redis.set(KEY, snapshots);
  } else {
    memory = snapshots;
  }
}

// Agrega/reemplaza un snapshot por su fecha valor y poda a los más recientes.
export async function upsert(snapshot) {
  if (!snapshot || !snapshot.fechaValor) {
    throw new Error('No se puede guardar un snapshot sin fecha valor');
  }
  const snapshots = { ...(await getStore()) };
  snapshots[snapshot.fechaValor] = snapshot;

  // YYYY-MM-DD ordena lexicográficamente igual que cronológicamente.
  const keys = Object.keys(snapshots).sort();
  while (keys.length > MAX_SNAPSHOTS) {
    delete snapshots[keys.shift()];
  }

  await saveStore(snapshots);
  return snapshots;
}

// Utilidad para pruebas locales: siembra el almacén directamente.
export async function seed(snapshots) {
  await saveStore(snapshots);
}

export const usingKV = hasKV;
