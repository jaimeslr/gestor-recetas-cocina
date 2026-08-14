import { Router, type Request, type Response, type NextFunction } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../auth.js';
import { validatePlanEntryPayload } from '../validators.js';
import { invalid, notFound, unauthorized } from '../errors.js';
import { consolidateShoppingList } from '../shoppingList.js';
import type { Day, MealSlot } from '../types/domain.js';
import type { HydratedPlan, HydratedPlanEntry } from '../types/api.js';

const router = Router();

router.get('/me/week', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw unauthorized('Sesión requerida');
    const monday = normalizeMonday(req.query.monday);
    const plan = store.getOrCreatePlan(user.id, monday);
    res.json({ plan: hydratePlan(plan) });
  } catch (e) {
    next(e);
  }
});

router.post('/me/week/entries', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw unauthorized('Sesión requerida');
    const { errors, data } = validatePlanEntryPayload(
      req.body as Record<string, unknown> | undefined,
    );
    if (errors.length) throw invalid('Plan inválido', { errors });
    const recipe = store.getRecipe(data.recipeId);
    if (!recipe || recipe.status !== 'publicada') throw notFound('Receta no disponible');
    const plan = store.getOrCreatePlan(user.id, data.monday);
    const existing = plan.entries.find((e) => e.day === data.day && e.meal === data.meal);
    if (existing) {
      store.updateEntry(plan.id, existing.id, {
        recipeId: recipe.id,
        servings: data.servings,
      });
    } else {
      store.addEntry(plan.id, {
        day: data.day as Day,
        meal: data.meal as MealSlot,
        recipeId: recipe.id,
        servings: data.servings,
      });
    }
    res.status(201).json({ plan: hydratePlan(plan) });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/me/week/entries/:id',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw unauthorized('Sesión requerida');
      const body = (req.body ?? {}) as { monday?: unknown; servings?: unknown };
      const monday = normalizeMonday(body.monday);
      const plan = store.getOrCreatePlan(user.id, monday);
      const entry = plan.entries.find((e) => e.id === req.params.id);
      if (!entry) throw notFound('Entrada no encontrada');
      const patch: { servings?: number } = {};
      const servings = Number(body.servings);
      if (Number.isInteger(servings) && servings >= 1 && servings <= 20) {
        patch.servings = servings;
      }
      store.updateEntry(plan.id, entry.id, patch);
      res.json({ plan: hydratePlan(plan) });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/me/week/entries/:id',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw unauthorized('Sesión requerida');
      const body = (req.body ?? {}) as { monday?: unknown };
      const rawMonday = body.monday ?? req.query.monday;
      const monday = normalizeMonday(rawMonday);
      const plan = store.getOrCreatePlan(user.id, monday);
      store.removeEntry(plan.id, req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

router.post('/me/shopping-list', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw unauthorized('Sesión requerida');
    const body = (req.body ?? {}) as { monday?: unknown };
    const monday = normalizeMonday(body.monday);
    const plan = store.getOrCreatePlan(user.id, monday);
    const recipes = store.listRecipes();
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const items = consolidateShoppingList(plan, recipeMap);
    res.json({ monday, items });
  } catch (e) {
    next(e);
  }
});

function normalizeMonday(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return currentMonday();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw invalid('Fecha inválida');
  return startOfISOWeek(date);
}

function currentMonday(): string {
  return startOfISOWeek(new Date());
}

function startOfISOWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function hydratePlan(plan: ReturnType<typeof store.getOrCreatePlan>): HydratedPlan {
  const entries = plan.entries
    .map((entry) => {
      const recipe = store.getRecipe(entry.recipeId);
      if (!recipe) return null;
      const hydrated: HydratedPlanEntry = {
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
      return hydrated;
    })
    .filter((e): e is HydratedPlanEntry => e !== null);
  return {
    id: plan.id,
    monday: plan.monday,
    entries,
  };
}

export default router;
