import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../auth.js';
import { validatePlanEntryPayload } from '../validators.js';
import { invalid, notFound } from '../errors.js';
import { consolidateShoppingList } from '../shoppingList.js';

const router = Router();

router.get('/me/week', requireAuth, (req, res) => {
  const monday = normalizeMonday(req.query.monday);
  const plan = store.getOrCreatePlan(req.user.id, monday);
  res.json({ plan: hydratePlan(plan) });
});

router.post('/me/week/entries', requireAuth, (req, res) => {
  const { errors, data } = validatePlanEntryPayload(req.body || {});
  if (errors.length) throw invalid('Plan inválido', { errors });
  const recipe = store.getRecipe(data.recipeId);
  if (!recipe || recipe.status !== 'publicada') throw notFound('Receta no disponible');
  const plan = store.getOrCreatePlan(req.user.id, data.monday);
  const existing = plan.entries.find(
    (e) => e.day === data.day && e.meal === data.meal
  );
  if (existing) {
    store.updateEntry(plan.id, existing.id, { recipeId: recipe.id, servings: data.servings });
  } else {
    store.addEntry(plan.id, { day: data.day, meal: data.meal, recipeId: recipe.id, servings: data.servings });
  }
  res.status(201).json({ plan: hydratePlan(plan) });
});

router.patch('/me/week/entries/:id', requireAuth, (req, res) => {
  const monday = normalizeMonday(req.body?.monday);
  const plan = store.getOrCreatePlan(req.user.id, monday);
  const entry = plan.entries.find((e) => e.id === req.params.id);
  if (!entry) throw notFound('Entrada no encontrada');
  const patch = {};
  if (Number.isInteger(Number(req.body?.servings)) && req.body.servings >= 1 && req.body.servings <= 20) {
    patch.servings = Number(req.body.servings);
  }
  store.updateEntry(plan.id, entry.id, patch);
  res.json({ plan: hydratePlan(plan) });
});

router.delete('/me/week/entries/:id', requireAuth, (req, res) => {
  const monday = normalizeMonday(req.body?.monday || req.query.monday);
  const plan = store.getOrCreatePlan(req.user.id, monday);
  store.removeEntry(plan.id, req.params.id);
  res.status(204).end();
});

router.post('/me/shopping-list', requireAuth, (req, res) => {
  const monday = normalizeMonday(req.body?.monday);
  const plan = store.getOrCreatePlan(req.user.id, monday);
  const recipes = store.listRecipes();
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const items = consolidateShoppingList(plan, recipeMap);
  res.json({ monday, items });
});

function normalizeMonday(raw) {
  if (!raw) return currentMonday();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw invalid('Fecha inválida');
  return startOfISOWeek(date);
}

function currentMonday() {
  return startOfISOWeek(new Date());
}

function startOfISOWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function hydratePlan(plan) {
  const recipes = plan.entries.map((entry) => {
    const recipe = store.getRecipe(entry.recipeId);
    if (!recipe) return null;
    return {
      entryId: entry.id,
      day: entry.day,
      meal: entry.meal,
      servings: entry.servings,
      recipe: {
        id: recipe.id,
        title: recipe.title,
        imageUrl: `/v1/recipes/${recipe.id}/image`,
        totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
      },
    };
  }).filter(Boolean);
  return {
    id: plan.id,
    monday: plan.monday,
    entries: recipes,
  };
}

export default router;
