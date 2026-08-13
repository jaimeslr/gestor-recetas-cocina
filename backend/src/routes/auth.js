import { Router } from 'express';
import { nanoid } from 'nanoid';
import { store } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
} from '../auth.js';
import { validateRegistration } from '../validators.js';
import { AppError, conflict, forbidden, invalid, unauthorized } from '../errors.js';

const router = Router();

function publicProfile(user, viewerId) {
  if (!user) return null;
  const isSelf = viewerId === user.id;
  const followers = store.listFollowers(user.id).length;
  const following = store.listFollowing(user.id).length;
  return {
    id: user.id,
    publicName: user.publicName,
    bio: user.bio,
    country: user.country,
    avatarColor: user.avatarColor,
    role: user.role,
    verified: !!user.verifiedAt,
    followers,
    following,
    isSelf,
    isFollowing: viewerId ? store.isFollowing({ followerId: viewerId, followedId: user.id }) : false,
  };
}

router.post('/register', (req, res) => {
  const { errors, data } = validateRegistration(req.body || {});
  if (errors.length) throw invalid('Datos inválidos', { errors });
  const existing = store.findUserByEmail(data.email);
  if (existing) throw conflict('Ese correo ya está registrado');
  const avatarColor = ['#f97316', '#10b981', '#6366f1', '#ec4899', '#facc15'][Math.floor(Math.random() * 5)];
  const user = store.createUser({
    email: data.email,
    passwordHash: hashPassword(data.password),
    publicName: data.publicName,
    avatarColor,
  });
  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  store.createSession({ userId: user.id, accessToken: access, refreshToken: refresh });
  const favorites = store.createCollection({ userId: user.id, name: 'Favoritas' });
  res.status(201).json({
    user: publicProfile(user, user.id),
    tokens: { access, refresh },
    favoritesCollectionId: favorites.id,
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw invalid('Credenciales incompletas');
  const user = store.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) throw unauthorized('Credenciales incorrectas');
  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  store.createSession({ userId: user.id, accessToken: access, refreshToken: refresh });
  res.json({ user: publicProfile(user, user.id), tokens: { access, refresh } });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw invalid('Refresh token requerido');
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw unauthorized('Refresh token inválido');
  const session = store.findSessionByToken(refreshToken);
  if (!session) throw unauthorized('Sesión no encontrada');
  const user = store.getUser(payload.sub);
  if (!user) throw unauthorized('Persona usuaria no encontrada');
  store.removeSessionByToken(refreshToken);
  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  store.createSession({ userId: user.id, accessToken: access, refreshToken: refresh });
  res.json({ tokens: { access, refresh } });
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) store.removeSessionByToken(refreshToken);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicProfile(req.user, req.user.id) });
});

router.patch('/me', requireAuth, (req, res) => {
  const updates = {};
  const { publicName, bio, country, avatarColor } = req.body || {};
  if (typeof publicName === 'string' && publicName.trim().length >= 2 && publicName.length <= 40) {
    updates.publicName = publicName.trim();
  }
  if (typeof bio === 'string') updates.bio = bio.slice(0, 200);
  if (typeof country === 'string' || country === null) updates.country = country || null;
  if (typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) updates.avatarColor = avatarColor;
  const user = store.updateUser(req.user.id, updates);
  res.json({ user: publicProfile(user, user.id) });
});

router.get('/users/:id', (req, res) => {
  const user = store.getUser(req.params.id);
  if (!user) throw new AppError('not_found', 'Persona no encontrada', 404);
  const viewerId = req.user?.id;
  res.json({ user: publicProfile(user, viewerId) });
});

router.get('/users/:id/recipes', (req, res) => {
  const user = store.getUser(req.params.id);
  if (!user) throw new AppError('not_found', 'Persona no encontrada', 404);
  const recipes = store
    .listRecipes()
    .filter((r) => r.authorId === user.id && r.status === 'publicada')
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  res.json({ recipes: recipes.map(serialiseRecipeSummary) });
});

router.post('/users/:id/follow', requireAuth, (req, res) => {
  const target = store.getUser(req.params.id);
  if (!target) throw new AppError('not_found', 'Persona no encontrada', 404);
  if (target.id === req.user.id) throw invalid('No puedes seguirte a ti mismo');
  store.follow({ followerId: req.user.id, followedId: target.id });
  res.status(201).json({ ok: true });
});

router.delete('/users/:id/follow', requireAuth, (req, res) => {
  const target = store.getUser(req.params.id);
  if (!target) throw new AppError('not_found', 'Persona no encontrada', 404);
  store.unfollow({ followerId: req.user.id, followedId: target.id });
  res.status(204).end();
});

function serialiseRecipeSummary(recipe) {
  const author = store.getUser(recipe.authorId);
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imagePrompt: recipe.imagePrompt,
    imageUrl: `/v1/recipes/${recipe.id}/image`,
    category: recipe.category,
    difficulty: recipe.difficulty,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
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

export { publicProfile, serialiseRecipeSummary };
export default router;
