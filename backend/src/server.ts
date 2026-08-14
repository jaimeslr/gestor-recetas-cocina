import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './db.js';
import { ALLERGENS, DIETS } from './vocabularies.js';
import { AppError } from './errors.js';
import authRoutes from './routes/auth.js';
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

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

app.use((req, res, next) => {
  req.requestId = Math.random().toString(36).slice(2, 10);
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

store.setAllergens(ALLERGENS);
store.setDiets(DIETS);

app.get('/v1/health', (_req: Request, res: Response) => {
  res.json({ ok: true, recipes: store.listRecipes().length, users: store.listUsers().length });
});

app.get('/v1/vocabularies', (_req: Request, res: Response) => {
  res.json({ allergens: ALLERGENS, diets: DIETS });
});

app.use('/v1/auth', authRoutes);
app.use('/v1/recipes', recipeRoutes);
app.use('/v1', feedRoutes);
app.use('/v1', planningRoutes);

app.use(express.static(FRONTEND_DIR));

app.get(/^\/(?!v1).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/v1')) {
    return next(new AppError('not_found', 'Ruta no encontrada', 404));
  }
  next();
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      traceId: res.getHeader('X-Request-Id'),
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('Unexpected error', err);
  res.status(500).json({
    code: 'internal_error',
    message: 'Error interno del servidor',
    traceId: res.getHeader('X-Request-Id'),
  });
};
app.use(errorHandler);

seedIfEmpty();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[recetas-api] escuchando en ${PORT}`);
});

export { app, store };