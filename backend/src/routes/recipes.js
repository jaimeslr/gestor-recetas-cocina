import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { validateRecipePayload } from '../validators.js';
import { AppError, forbidden, invalid, notFound } from '../errors.js';
import { serialiseRecipeFull } from './recipeSerialiser.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  if (!req.user.verifiedAt) {
    throw forbidden('Verifica tu correo antes de publicar');
  }
  const { errors, data } = validateRecipePayload(req.body || {});
  if (errors.length) throw invalid('Datos de receta inválidos', { errors });
  const recipe = store.createRecipe({ ...data, authorId: req.user.id });
  res.status(201).json({ recipe: serialiseRecipeFull(recipe, req.user.id) });
});

router.get('/:id', optionalAuth, (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe || recipe.status === 'oculta') throw notFound('Receta no encontrada');
  res.json({ recipe: serialiseRecipeFull(recipe, req.user?.id) });
});

router.patch('/:id', requireAuth, (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) throw notFound('Receta no encontrada');
  if (recipe.authorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') {
    throw forbidden('No puedes editar esta receta');
  }
  const { errors, data } = validateRecipePayload(req.body || {}, { isUpdate: true });
  if (errors.length) throw invalid('Datos de receta inválidos', { errors });
  const updated = store.updateRecipe(recipe.id, data);
  res.json({ recipe: serialiseRecipeFull(updated, req.user.id) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) throw notFound('Receta no encontrada');
  if (recipe.authorId !== req.user.id && req.user.role !== 'admin') {
    throw forbidden('No puedes borrar esta receta');
  }
  store.hideRecipe(recipe.id);
  res.status(204).end();
});

router.post('/:id/rate', requireAuth, (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) throw notFound('Receta no encontrada');
  const stars = Number(req.body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw invalid('Puntuación inválida');
  store.setRating({ userId: req.user.id, recipeId: recipe.id, stars });
  const updated = store.getRecipe(recipe.id);
  res.json({ recipe: serialiseRecipeFull(updated, req.user.id) });
});

router.get('/:id/image', (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) throw notFound('Receta no encontrada');
  const svg = generateRecipeImage(recipe);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

function generateRecipeImage(recipe) {
  const palettes = [
    ['#fde68a', '#f97316'],
    ['#bbf7d0', '#10b981'],
    ['#bae6fd', '#0ea5e9'],
    ['#fbcfe8', '#ec4899'],
    ['#fecaca', '#ef4444'],
    ['#ddd6fe', '#6366f1'],
  ];
  const hash = recipe.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const [bg, accent] = palettes[hash % palettes.length];
  const title = recipe.title.length > 38 ? recipe.title.slice(0, 35) + '...' : recipe.title;
  const category = recipe.category.toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="520" fill="url(#g)"/>
  <circle cx="640" cy="120" r="120" fill="${accent}" opacity="0.35"/>
  <circle cx="160" cy="400" r="160" fill="${accent}" opacity="0.25"/>
  <text x="60" y="120" font-family="Georgia, serif" font-size="28" fill="${accent}" font-weight="700">${category}</text>
  <text x="60" y="220" font-family="Georgia, serif" font-size="48" fill="#1f2937" font-weight="700">${escape(title)}</text>
  <text x="60" y="270" font-family="Helvetica, sans-serif" font-size="22" fill="#1f2937">${recipe.prepMinutes + recipe.cookMinutes} min · ${recipe.servings} rac.</text>
  <text x="60" y="320" font-family="Helvetica, sans-serif" font-size="18" fill="#374151" opacity="0.8">${recipe.difficulty.toUpperCase()}</text>
</svg>`;
}

function escape(text) {
  return text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

export default router;
