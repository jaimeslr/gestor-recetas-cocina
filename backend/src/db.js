// Capa de persistencia en memoria. Mantiene la lógica de dominio desacoplada
// del almacenamiento real para que el MVP funcione sin MongoDB en este entorno.
import { nanoid } from 'nanoid';

const now = () => new Date().toISOString();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class MemoryStore {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.verifications = new Map();
    this.recipes = new Map();
    this.comments = new Map();
    this.ratings = new Map();
    this.collections = new Map();
    this.saves = new Map();
    this.follows = new Map();
    this.plans = new Map();
    this.reports = new Map();
    this.allergens = [];
    this.diets = [];
  }

  // --- Usuarios ---
  createUser(user) {
    const id = nanoid(12);
    const record = {
      id,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      publicName: user.publicName,
      bio: user.bio || '',
      country: user.country || null,
      avatarColor: user.avatarColor || '#f97316',
      role: user.role || 'user',
      verifiedAt: user.verifiedAt || now(),
      createdAt: now(),
    };
    this.users.set(id, record);
    return record;
  }

  findUserByEmail(email) {
    const target = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === target) return user;
    }
    return null;
  }

  getUser(id) {
    return this.users.get(id) || null;
  }

  updateUser(id, patch) {
    const current = this.users.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.users.set(id, next);
    return next;
  }

  listUsers() {
    return Array.from(this.users.values());
  }

  // --- Sesiones / tokens ---
  createSession({ userId, accessToken, refreshToken, expiresAt }) {
    const session = { id: nanoid(10), userId, accessToken, refreshToken, expiresAt };
    this.sessions.set(accessToken, session);
    this.sessions.set(refreshToken, session);
    return session;
  }

  findSessionByToken(token) {
    return this.sessions.get(token) || null;
  }

  removeSessionByToken(token) {
    const session = this.sessions.get(token);
    if (!session) return null;
    this.sessions.delete(session.accessToken);
    this.sessions.delete(session.refreshToken);
    return session;
  }

  // --- Verificación de email ---
  saveVerification({ userId, code, expiresAt }) {
    this.verifications.set(userId, { code, expiresAt });
  }

  consumeVerification(userId, code) {
    const record = this.verifications.get(userId);
    if (!record) return false;
    if (record.code !== code) return false;
    if (new Date(record.expiresAt).getTime() < Date.now()) return false;
    this.verifications.delete(userId);
    return true;
  }

  // --- Recetas ---
  createRecipe(recipe) {
    const id = nanoid(14);
    const record = {
      id,
      authorId: recipe.authorId,
      title: recipe.title,
      description: recipe.description || '',
      imagePrompt: recipe.imagePrompt || recipe.title,
      category: recipe.category,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      diets: recipe.diets || [],
      allergens: recipe.allergens || [],
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      status: recipe.status || 'publicada',
      publishedAt: recipe.publishedAt || now(),
      ratingSum: 0,
      ratingCount: 0,
      saveCount: 0,
    };
    this.recipes.set(id, record);
    return record;
  }

  getRecipe(id) {
    return this.recipes.get(id) || null;
  }

  updateRecipe(id, patch) {
    const current = this.recipes.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.recipes.set(id, next);
    return next;
  }

  listRecipes() {
    return Array.from(this.recipes.values());
  }

  hideRecipe(id) {
    return this.updateRecipe(id, { status: 'oculta' });
  }

  // --- Comentarios ---
  addComment(comment) {
    const id = nanoid(12);
    const record = {
      id,
      recipeId: comment.recipeId,
      authorId: comment.authorId,
      text: comment.text,
      parentId: comment.parentId || null,
      createdAt: now(),
    };
    this.comments.set(id, record);
    return record;
  }

  listComments(recipeId) {
    return Array.from(this.comments.values())
      .filter((c) => c.recipeId === recipeId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  countComments(recipeId) {
    return this.listComments(recipeId).length;
  }

  // --- Valoraciones ---
  setRating({ userId, recipeId, stars }) {
    const key = `${userId}:${recipeId}`;
    const previous = this.ratings.get(key);
    this.ratings.set(key, { userId, recipeId, stars, createdAt: previous?.createdAt || now() });
    this.recalculateRating(recipeId);
    return this.ratings.get(key);
  }

  getRating({ userId, recipeId }) {
    return this.ratings.get(`${userId}:${recipeId}`) || null;
  }

  recalculateRating(recipeId) {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return;
    let sum = 0;
    let count = 0;
    for (const rating of this.ratings.values()) {
      if (rating.recipeId === recipeId) {
        sum += rating.stars;
        count += 1;
      }
    }
    recipe.ratingSum = sum;
    recipe.ratingCount = count;
  }

  // --- Colecciones ---
  createCollection({ userId, name }) {
    const id = nanoid(10);
    const record = { id, userId, name, createdAt: now() };
    this.collections.set(id, record);
    return record;
  }

  listCollections(userId) {
    return Array.from(this.collections.values()).filter((c) => c.userId === userId);
  }

  getCollection(id) {
    return this.collections.get(id) || null;
  }

  updateCollection(id, patch) {
    const current = this.collections.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.collections.set(id, next);
    return next;
  }

  deleteCollection(id) {
    this.collections.delete(id);
    this.saves.forEach((save, key) => {
      if (save.collectionId === id) this.saves.delete(key);
    });
  }

  // --- Guardados ---
  saveRecipe({ userId, recipeId, collectionId }) {
    const key = `${userId}:${recipeId}:${collectionId}`;
    const existing = this.saves.get(key);
    if (existing) return existing;
    const record = { id: nanoid(10), userId, recipeId, collectionId, createdAt: now() };
    this.saves.set(key, record);
    this.recalculateSaveCount(recipeId);
    return record;
  }

  unsaveRecipe({ userId, recipeId, collectionId }) {
    const key = `${userId}:${recipeId}:${collectionId}`;
    const existing = this.saves.get(key);
    if (!existing) return false;
    this.saves.delete(key);
    this.recalculateSaveCount(recipeId);
    return true;
  }

  listSavesForUser(userId) {
    return Array.from(this.saves.values()).filter((s) => s.userId === userId);
  }

  listSavesForRecipe(recipeId) {
    return Array.from(this.saves.values()).filter((s) => s.recipeId === recipeId);
  }

  recalculateSaveCount(recipeId) {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return;
    recipe.saveCount = 0;
    for (const save of this.saves.values()) {
      if (save.recipeId === recipeId) recipe.saveCount += 1;
    }
  }

  // --- Seguimientos ---
  follow({ followerId, followedId }) {
    const key = `${followerId}:${followedId}`;
    if (this.follows.has(key)) return this.follows.get(key);
    const record = { id: nanoid(10), followerId, followedId, createdAt: now() };
    this.follows.set(key, record);
    return record;
  }

  unfollow({ followerId, followedId }) {
    const key = `${followerId}:${followedId}`;
    if (!this.follows.has(key)) return false;
    this.follows.delete(key);
    return true;
  }

  isFollowing({ followerId, followedId }) {
    return this.follows.has(`${followerId}:${followedId}`);
  }

  listFollowers(userId) {
    return Array.from(this.follows.values()).filter((f) => f.followedId === userId);
  }

  listFollowing(userId) {
    return Array.from(this.follows.values()).filter((f) => f.followerId === userId);
  }

  // --- Plan semanal ---
  getOrCreatePlan(userId, monday) {
    const key = `${userId}:${monday}`;
    let plan = this.plans.get(key);
    if (!plan) {
      plan = { id: key, userId, monday, entries: [] };
      this.plans.set(key, plan);
    }
    return plan;
  }

  addEntry(planId, entry) {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    const id = nanoid(10);
    const record = { id, ...entry };
    plan.entries.push(record);
    return record;
  }

  updateEntry(planId, entryId, patch) {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    const idx = plan.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return null;
    plan.entries[idx] = { ...plan.entries[idx], ...patch };
    return plan.entries[idx];
  }

  removeEntry(planId, entryId) {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    const before = plan.entries.length;
    plan.entries = plan.entries.filter((e) => e.id !== entryId);
    return plan.entries.length < before;
  }

  // --- Vocabularios ---
  setAllergens(list) {
    this.allergens = list;
  }

  setDiets(list) {
    this.diets = list;
  }

  // --- Reportes ---
  addReport(report) {
    const id = nanoid(10);
    const record = { id, status: 'pendiente', createdAt: now(), ...report };
    this.reports.set(id, record);
    return record;
  }

  listReports(status) {
    return Array.from(this.reports.values()).filter((r) => !status || r.status === status);
  }
}

export const store = new MemoryStore();
export const STATE = { clone };
