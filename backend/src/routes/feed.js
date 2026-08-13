import { Router } from 'express';
import { store } from '../db.js';
import { optionalAuth, requireAuth } from '../auth.js';
import { validateSearchFilters } from '../validators.js';
import { invalid, notFound } from '../errors.js';
import { serialiseRecipeFull } from './recipeSerialiser.js';

const router = Router();

function applyFilters(recipes, filters) {
  return recipes.filter((r) => {
    if (r.status !== 'publicada') return false;
    if (filters.allergens?.length) {
      const hasAny = r.allergens.some((a) => filters.allergens.includes(a));
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

function sortRecipes(recipes, sort) {
  const copy = [...recipes];
  if (sort === 'top') {
    copy.sort((a, b) => (b.ratingSum / Math.max(b.ratingCount, 1)) - (a.ratingSum / Math.max(a.ratingCount, 1)));
  } else if (sort === 'masGuardadas') {
    copy.sort((a, b) => b.saveCount - a.saveCount);
  } else {
    copy.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
  return copy;
}

router.get('/feed', optionalAuth, (req, res) => {
  const scope = req.query.scope === 'seguidos' ? 'seguidos' : 'cronologico';
  const limit = clampInt(req.query.limit, 1, 50, 20);
  let recipes = store.listRecipes().filter((r) => r.status === 'publicada');
  if (scope === 'seguidos') {
    if (!req.user) return res.json({ recipes: [] });
    const followed = store.listFollowing(req.user.id).map((f) => f.followedId);
    recipes = recipes.filter((r) => followed.includes(r.authorId));
  }
  recipes.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  res.json({ recipes: recipes.slice(0, limit).map(serialiseRecipeSummaryForFeed) });
});

router.get('/search', optionalAuth, (req, res) => {
  const filters = validateSearchFilters(req.query);
  const recipes = sortRecipes(applyFilters(store.listRecipes(), filters), filters.sort);
  res.json({ recipes: recipes.slice(0, 50).map(serialiseRecipeSummaryForFeed) });
});

router.get('/recipes/:id/related', (req, res) => {
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
});

router.post('/recipes/:id/comments', requireAuth, (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) throw notFound('Receta no encontrada');
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 500) throw invalid('Comentario inválido');
  const parentId = req.body?.parentId || null;
  if (parentId) {
    const parent = store.listComments(recipe.id).find((c) => c.id === parentId);
    if (!parent || parent.parentId) throw invalid('Respuesta no permitida');
  }
  const comment = store.addComment({
    recipeId: recipe.id,
    authorId: req.user.id,
    text,
    parentId,
  });
  res.status(201).json({ comment });
});

router.get('/recipes/:id/comments', (req, res) => {
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
});

router.post('/recipes/:id/save', requireAuth, (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) throw notFound('Receta no encontrada');
  let collectionId = req.body?.collectionId;
  if (!collectionId) {
    const fav = store.listCollections(req.user.id).find((c) => c.name === 'Favoritas');
    if (fav) collectionId = fav.id;
    else if (req.user) {
      const created = store.createCollection({ userId: req.user.id, name: 'Favoritas' });
      collectionId = created.id;
    }
  }
  const collection = store.getCollection(collectionId);
  if (!collection || collection.userId !== req.user.id) throw invalid('Colección inválida');
  store.saveRecipe({ userId: req.user.id, recipeId: recipe.id, collectionId });
  res.status(201).json({ ok: true });
});

router.delete('/recipes/:id/save', requireAuth, (req, res) => {
  const collectionId = req.query.collectionId || req.body?.collectionId;
  if (!collectionId) throw invalid('collectionId requerido');
  store.unsaveRecipe({ userId: req.user.id, recipeId: req.params.id, collectionId });
  res.status(204).end();
});

router.get('/me/collections', requireAuth, (req, res) => {
  const collections = store.listCollections(req.user.id);
  res.json({ collections });
});

router.post('/me/collections', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name || name.length > 40) throw invalid('Nombre inválido');
  const collection = store.createCollection({ userId: req.user.id, name });
  res.status(201).json({ collection });
});

router.patch('/me/collections/:id', requireAuth, (req, res) => {
  const collection = store.getCollection(req.params.id);
  if (!collection || collection.userId !== req.user.id) throw notFound('Colección no encontrada');
  const name = String(req.body?.name || '').trim();
  if (!name || name.length > 40) throw invalid('Nombre inválido');
  const updated = store.updateCollection(collection.id, { name });
  res.json({ collection: updated });
});

router.delete('/me/collections/:id', requireAuth, (req, res) => {
  const collection = store.getCollection(req.params.id);
  if (!collection || collection.userId !== req.user.id) throw notFound('Colección no encontrada');
  if (collection.name === 'Favoritas') throw invalid('La colección Favoritas no se puede borrar');
  store.deleteCollection(collection.id);
  res.status(204).end();
});

router.get('/me/saved', requireAuth, (req, res) => {
  const saves = store.listSavesForUser(req.user.id);
  const data = saves.map((s) => {
    const recipe = store.getRecipe(s.recipeId);
    const collection = store.getCollection(s.collectionId);
    return {
      save: s,
      recipe: recipe ? serialiseRecipeFull(recipe, req.user.id) : null,
      collection,
    };
  });
  res.json({ saved: data });
});

function publicUser(id) {
  const user = store.getUser(id);
  if (!user) return null;
  return { id: user.id, publicName: user.publicName, avatarColor: user.avatarColor };
}

function serialiseRecipeSummaryForFeed(recipe) {
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

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

export default router;
