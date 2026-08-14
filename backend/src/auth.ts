import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from 'express';
import type { User, UserRole } from './types/domain.js';
import { store } from './db.js';
import { unauthorized, forbidden } from './errors.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const ACCESS_TTL = '12h';
const REFRESH_TTL_DAYS = 30;

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  name: string;
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      authPayload?: AccessTokenPayload | RefreshTokenPayload;
    }
  }
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signAccessToken(user: User): string {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.publicName },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL, audience: 'recipes-api' },
  );
}

export function signRefreshToken(user: User): string {
  return jwt.sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, {
    expiresIn: `${REFRESH_TTL_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET, { audience: 'recipes-api' });
    if (typeof payload !== 'object' || payload === null) return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    if (typeof payload !== 'object' || payload === null) return null;
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized('Token requerido'));
  const payload = verifyAccessToken(token);
  if (!payload) return next(unauthorized('Token inválido o caducado'));
  const user = store.getUser(payload.sub);
  if (!user) return next(unauthorized('Persona usuaria no encontrada'));
  req.user = user;
  req.authPayload = payload;
  next();
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      const user = store.getUser(payload.sub);
      if (user) {
        req.user = user;
        req.authPayload = payload;
      }
    }
  }
  next();
};

export function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role && req.user.role !== 'admin') {
      return next(forbidden('Requiere rol ' + role));
    }
    next();
  };
}