import { Router, type Request, type Response, type NextFunction } from 'express';
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
import { AppError, conflict, invalid, unauthorized } from '../errors.js';
import type { Recipe, User } from '../types/domain.js';
import type { PublicUser, RecipeSummary } from '../types/api.js';

export function publicProfile(user: User | null, viewerId: string | null | undefined): PublicUser | null {
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
    isFollowing: viewerId
      ? store.isFollowing({ followerId: viewerId, followedId: user.id })
      : false,
  };
}

export function serialiseRecipeSummary(recipe: Recipe): RecipeSummary {
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

const router = Router();

function sessionExpiresAt(): string {
  // 30 días por defecto, alineado con auth.ts.
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24 * 30;
  return new Date((issuedAt + expiresIn) * 1000).toISOString();
}

router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { errors, data } = validateRegistration(req.body as Record<string, unknown> | undefined);
    if (errors.length) throw invalid('Datos inválidos', { errors });
    const existing = store.findUserByEmail(data.email);
    if (existing) throw conflict('Ese correo ya está registrado');
    const palette = ['#f97316', '#10b981', '#6366f1', '#ec4899', '#facc15'];
    const avatarColor = palette[Math.floor(Math.random() * palette.length)] ?? '#f97316';
    const user = store.createUser({
      email: data.email,
      passwordHash: hashPassword(data.password),
      publicName: data.publicName,
      avatarColor,
    });
    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    store.createSession({
      userId: user.id,
      accessToken: access,
      refreshToken: refresh,
      expiresAt: sessionExpiresAt(),
    });
    const favorites = store.createCollection({ userId: user.id, name: 'Favoritas' });
    res.status(201).json({
      user: publicProfile(user, user.id),
      tokens: { access, refresh },
      favoritesCollectionId: favorites.id,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) throw invalid('Credenciales incompletas');
    const user = store.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) throw unauthorized('Credenciales incorrectas');
    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    store.createSession({
      userId: user.id,
      accessToken: access,
      refreshToken: refresh,
      expiresAt: sessionExpiresAt(),
    });
    res.json({ user: publicProfile(user, user.id), tokens: { access, refresh } });
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { refreshToken?: unknown };
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
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
    store.createSession({
      userId: user.id,
      accessToken: access,
      refreshToken: refresh,
      expiresAt: sessionExpiresAt(),
    });
    res.json({ tokens: { access, refresh } });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { refreshToken?: unknown };
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
    if (refreshToken) store.removeSessionByToken(refreshToken);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ code: 'unauthorized', message: 'Sesión requerida' });
    return;
  }
  res.json({ user: publicProfile(user, user.id) });
});

router.patch('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw unauthorized('Sesión requerida');
    const updates: Partial<Pick<User, 'publicName' | 'bio' | 'country' | 'avatarColor'>> = {};
    const body = (req.body ?? {}) as {
      publicName?: unknown;
      bio?: unknown;
      country?: unknown;
      avatarColor?: unknown;
    };
    if (
      typeof body.publicName === 'string' &&
      body.publicName.trim().length >= 2 &&
      body.publicName.length <= 40
    ) {
      updates.publicName = body.publicName.trim();
    }
    if (typeof body.bio === 'string') updates.bio = body.bio.slice(0, 200);
    if (typeof body.country === 'string' || body.country === null) {
      updates.country = (body.country as string | null) || null;
    }
    if (
      typeof body.avatarColor === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(body.avatarColor)
    ) {
      updates.avatarColor = body.avatarColor;
    }
    const updatedUser = store.updateUser(user.id, updates);
    res.json({ user: publicProfile(updatedUser, user.id) });
  } catch (e) {
    next(e);
  }
});

router.get('/users/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = store.getUser(req.params.id);
    if (!user) throw new AppError('not_found', 'Persona no encontrada', 404);
    res.json({ user: publicProfile(user, req.user?.id) });
  } catch (e) {
    next(e);
  }
});

router.get('/users/:id/recipes', (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = store.getUser(req.params.id);
    if (!user) throw new AppError('not_found', 'Persona no encontrada', 404);
    const recipes = store
      .listRecipes()
      .filter((r) => r.authorId === user.id && r.status === 'publicada')
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    res.json({ recipes: recipes.map(serialiseRecipeSummary) });
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id/follow', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw unauthorized('Sesión requerida');
    const target = store.getUser(req.params.id);
    if (!target) throw new AppError('not_found', 'Persona no encontrada', 404);
    if (target.id === user.id) throw invalid('No puedes seguirte a ti mismo');
    store.follow({ followerId: user.id, followedId: target.id });
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/users/:id/follow', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw unauthorized('Sesión requerida');
    const target = store.getUser(req.params.id);
    if (!target) throw new AppError('not_found', 'Persona no encontrada', 404);
    store.unfollow({ followerId: user.id, followedId: target.id });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
