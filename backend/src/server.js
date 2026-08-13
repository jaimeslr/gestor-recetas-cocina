import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './db.js';
import { ALLERGENS, DIETS } from './vocabularies.js';
import { AppError } from './errors.js';
import authRoutes, { publicProfile } from './routes/auth.js';
import recipeRoutes from './routes/recipes.js';
import feedRoutes from './routes/feed.js';
import planningRoutes from './routes/planning.js';
import { seedIfEmpty } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  req.requestId = Math.random().toString(36).slice(2, 10);
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

store.setAllergens(ALLERGENS);
store.setDiets(DIETS);

app.get('/v1/health', (_req, res) => {
  res.json({ ok: true, recipes: store.listRecipes().length, users: store.listUsers().length });
});

app.get('/v1/vocabularies', (_req, res) => {
  res.json({ allergens: ALLERGENS, diets: DIETS });
});

app.use('/v1/auth', authRoutes);
app.use('/v1/recipes', recipeRoutes);
app.use('/v1', feedRoutes);
app.use('/v1', planningRoutes);

app.use(express.static(FRONTEND_DIR));

app.get(/^\/(?!v1).*/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/v1')) {
    return next(new AppError('not_found', 'Ruta no encontrada', 404));
  }
  next();
});

app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      traceId: res.getHeader('X-Request-Id'),
    });
  }
  // eslint-disable-next-line no-console
  console.error('Unexpected error', err);
  res.status(500).json({
    code: 'internal_error',
    message: 'Error interno del servidor',
    traceId: res.getHeader('X-Request-Id'),
  });
});

seedIfEmpty();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[recetas-api] escuchando en ${PORT}`);
});

export { app, store };
