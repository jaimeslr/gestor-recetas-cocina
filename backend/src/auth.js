import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { store } from './db.js';
import { unauthorized, forbidden } from './errors.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const ACCESS_TTL = '12h';
const REFRESH_TTL_DAYS = 30;

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.publicName },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL, audience: 'recipes-api' }
  );
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, {
    expiresIn: `${REFRESH_TTL_DAYS}d`,
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET, { audience: 'recipes-api' });
  } catch (e) {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (e) {
    return null;
  }
}

export function requireAuth(req, res, next) {
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
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = store.getUser(payload.sub);
      req.authPayload = payload;
    }
  }
  next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role && req.user.role !== 'admin') return next(forbidden('Requiere rol ' + role));
    next();
  };
}
