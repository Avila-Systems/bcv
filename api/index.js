// Punto de entrada serverless de Vercel. El runtime de Node acepta una app
// Express como handler; todas las rutas se enrutan aquí vía vercel.json.
import app from '../src/server.js';

export default app;
