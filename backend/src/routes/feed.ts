import { Router, type Request, type Response, type NextFunction } from 'express';
import { store } from '../db.js';
import { optionalAuth, requireAuth } from '../auth.js';
import { validateSearchFilters, type SearchFilters } from '../validators.js';
import { invalid, notFound } from '../errors.js';
import { serialiseRecipeFull } from './recipeSerialiser.js';
import type { Recipe, User } from '../types/domain.js';

type ParsedQuery = Record<string, string | string[] | undefined>;

const router = Router();

function asParsedQuery(input: Record<string, unknown>): ParsedQuery {
  const out: ParsedQuery = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.filter((v): v is string => typeof v === 'string');
    }
  }
  return out;
}

function applyFilters(recipes: Recipe[], filters: SearchFilters): Recipe[] {
  return recipes.filter((r) => {
    if (r.status !== 'publicada') return false;
    if (filters.allergens?.length) {
      const hasAny = r.allergens.some((a) => filters.allergens?.includes(a));
      if (hasAny) return false;
    }
    if (filters.diets?.length) {
      const all = filters.diets.every((d) => r.diets.includes(d));
      if (!all) return false;
    }
    if (filters.maxTime) {
      if (r.prepMinutes + r.cookMinutes > filters.maxTime) return false;
    }
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false;
    if (filters.category && r.category !== filters.category) return false;
    if (filters.q) {
      const haystack = [
        r.title,
        r.description,
        ...r.ingredients.map((i) => i.name),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(filters.q)) return false;
    }
    return true;
  });
}

function sortRecipes(recipes: Recipe[], sort?: string): Recipe[] {
  const copy = [...recipes];
  if (sort === 'top') {
    copy.sort((a, b) => {
      const av = a.ratingCount ? a.ratingSum / a.ratingCount : 0;
      const bv = b.ratingCount ? b.ratingSum / b.ratingCount : 0;
      return bv - av;
    });
  } else if (sort === 'masGuardadas') {
    copy.sort((a, b) => b.saveCount - a.saveCount);
  } else {
    copy.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
  return copy;
}

router.get('/feed', optionalAuth, (req: Request, res: Response) => {
  const scope = req.query.scope === 'seguidos' ? 'seguidos' : 'cronologico';
  const limit = clampInt(req.query.limit, 1, 50, 20);
  let recipes = store.listRecipes().filter((r) => r.status === 'publicada');
  if (scope === 'seguidos') {
    if (!req.user) {
      res.json({ recipes: [] });
      return;
    }
    const followed = store.listFollowing(req.user.id).map((f) => f.followedId);
    recipes = recipes.filter((r) => followed.includes(r.authorId));
  }
  recipes.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  res.json({ recipes: recipes.slice(0, limit).map(serialiseRecipeSummaryForFeed) });
});

router.get('/search', optionalAuth, (req: Request, res: Response) => {
  const filters = validateSearchFilters(asParsedQuery(req.query as Record<string, unknown>));
  const recipes = sortRecipes(applyFilters(store.listRecipes(), filters), filters.sort);
  res.json({ recipes: recipes.slice(0, 50).map(serialiseRecipeSummaryForFeed) });
});

router.get('/recipes/:id/related', (req: Request, res: Response, next: NextFunction) => {
  try {
    const recipe = store.getRecipe(req.params.id);
    if (!recipe) throw notFound('Receta no encontrada');
    const candidates = store
      .listRecipes()
      .filter((r) => r.id !== recipe.id && r.status === 'publicada')
      .map((r) => {
        const commonDiets = r.diets.filter((d) => recipe.diets.includes(d)).length;
        const commonAllergens = r.allergens.filter((a) => recipe.allergens.includes(a)).length;
        const score = commonDiets * 2 + commonAllergens;
        return { r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.r);
    res.json({ recipes: candidates.map(serialiseRecipeSummaryForFeed) });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/recipes/:id/comments',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw invalid('Sesión requerida');
      const recipe = store.getRecipe(req.params.id);
      if (!recipe) throw notFound('Receta no encontrada');
      const body = (req.body ?? {}) as { text?: unknown; parentId?: unknown };
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 500) throw invalid('Comentario inválido');
      const parentId = typeof body.parentId === 'string' ? body.parentId : null;
      if (parentId) {
        const parent = store.listComments(recipe.id).find((c) => c.id === parentId);
        if (!parent || parent.parentId) throw invalid('Respuesta no permitida');
      }
      const comment = store.addComment({
        recipeId: recipe.id,
        authorId: user.id,
        text,
        parentId,
      });
      res.status(201).json({ comment });
    } catch (e) {
      next(e);
    }
  },
);

router.get('/recipes/:id/comments', (req: Request, res: Response, next: NextFunction) => {
  try {
    const recipe = store.getRecipe(req.params.id);
    if (!recipe) throw notFound('Receta no encontrada');
    const comments = store.listComments(recipe.id);
    const root = comments.filter((c) => !c.parentId);
    const replies = comments.filter((c) => c.parentId);
    const enriched = root.map((c) => ({
      ...c,
      author: publicUser(c.authorId),
      replies: replies
        .filter((r) => r.parentId === c.id)
        .map((r) => ({ ...r, author: publicUser(r.authorId) })),
    }));
    res.json({ comments: enriched });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/recipes/:id/save',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw invalid('Sesión requerida');
      const recipe = store.getRecipe(req.params.id);
      if (!recipe) throw notFound('Receta no encontrada');
      const body = (req.body ?? {}) as { collectionId?: unknown };
      let collectionId = typeof body.collectionId === 'string' ? body.collectionId : '';
      if (!collectionId) {
        const fav = store.listCollections(user.id).find((c) => c.name === 'Favoritas');
        if (fav) collectionId = fav.id;
        else {
          const created = store.createCollection({ userId: user.id, name: 'Favoritas' });
          collectionId = created.id;
        }
      }
      const collection = store.getCollection(collectionId);
      if (!collection || collection.userId !== user.id) throw invalid('Colección inválida');
      store.saveRecipe({ userId: user.id, recipeId: recipe.id, collectionId });
      res.status(201).json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/recipes/:id/save',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw invalid('Sesión requerida');
      const body = (req.body ?? {}) as { collectionId?: unknown };
      const collectionId =
        (typeof req.query.collectionId === 'string' ? req.query.collectionId : '') ||
        (typeof body.collectionId === 'string' ? body.collectionId : '');
      if (!collectionId) throw invalid('collectionId requerido');
      store.unsaveRecipe({
        userId: user.id,
        recipeId: req.params.id,
        collectionId,
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

router.get('/me/collections', requireAuth, (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ code: 'unauthorized', message: 'Sesión requerida' });
    return;
  }
  const collections = store.listCollections(user.id);
  res.json({ collections });
});

router.post('/me/collections', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw invalid('Sesión requerida');
    const name = String((req.body ?? {}).name ?? '').trim();
    if (!name || name.length > 40) throw invalid('Nombre inválido');
    const collection = store.createCollection({ userId: user.id, name });
    res.status(201).json({ collection });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/me/collections/:id',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw invalid('Sesión requerida');
      const collection = store.getCollection(req.params.id);
      if (!collection || collection.userId !== user.id) {
        throw notFound('Colección no encontrada');
      }
      const name = String((req.body ?? {}).name ?? '').trim();
      if (!name || name.length > 40) throw invalid('Nombre inválido');
      const updated = store.updateCollection(collection.id, { name });
      res.json({ collection: updated });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/me/collections/:id',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw invalid('Sesión requerida');
      const collection = store.getCollection(req.params.id);
      if (!collection || collection.userId !== user.id) {
        throw notFound('Colección no encontrada');
      }
      if (collection.name === 'Favoritas') throw invalid('La colección Favoritas no se puede borrar');
      store.deleteCollection(collection.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

router.get('/me/saved', requireAuth, (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ code: 'unauthorized', message: 'Sesión requerida' });
    return;
  }
  const saves = store.listSavesForUser(user.id);
  const data = saves.map((s) => {
    const recipe = store.getRecipe(s.recipeId);
    const collection = store.getCollection(s.collectionId);
    return {
      save: s,
      recipe: recipe ? serialiseRecipeFull(recipe, user.id) : null,
      collection,
    };
  });
  res.json({ saved: data });
});

interface PublicAuthor {
  id: string;
  publicName: string;
  avatarColor: string | undefined;
}

function publicUser(id: string): PublicAuthor | null {
  const user: User | null = store.getUser(id);
  if (!user) return null;
  return { id: user.id, publicName: user.publicName, avatarColor: user.avatarColor };
}

function serialiseRecipeSummaryForFeed(recipe: Recipe) {
  const author = store.getUser(recipe.authorId);
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imageUrl: `/v1/recipes/${recipe.id}/image`,
    category: recipe.category,
    difficulty: recipe.difficulty,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
    servings: recipe.servings,
    diets: recipe.diets,
    allergens: recipe.allergens,
    ratingAvg: recipe.ratingCount ? recipe.ratingSum / recipe.ratingCount : 0,
    ratingCount: recipe.ratingCount,
    saveCount: recipe.saveCount,
    author: author
      ? { id: author.id, publicName: author.publicName, avatarColor: author.avatarColor }
      : null,
    publishedAt: recipe.publishedAt,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

export default router;
