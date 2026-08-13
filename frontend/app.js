// Cliente de la aplicación. Encapsula API, sesión, enrutador y componentes de UI.
import { renderFeed } from './views/feed.js';
import { renderRecipe } from './views/recipe.js';
import { renderSearch } from './views/search.js';
import { renderCreateRecipe } from './views/createRecipe.js';
import { renderWeek } from './views/week.js';
import { renderShopping } from './views/shopping.js';
import { renderLogin, renderRegister } from './views/auth.js';
import { renderMe, renderUserProfile } from './views/profile.js';

const API_BASE = '/v1';

const state = {
  user: null,
  tokens: null,
  vocabularies: null,
  activeView: null,
};

const listeners = new Set();

function emit() {
  for (const cb of listeners) cb();
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem('recetas-session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  if (session) localStorage.setItem('recetas-session', JSON.stringify(session));
  else localStorage.removeItem('recetas-session');
}

export function getSession() {
  return { user: state.user, tokens: state.tokens };
}

export function getVocabularies() {
  return state.vocabularies;
}

export async function bootstrap() {
  const stored = loadStoredSession();
  if (stored?.user && stored?.tokens) {
    state.user = stored.user;
    state.tokens = stored.tokens;
  }
  try {
    state.vocabularies = await api('/vocabularies');
    exposeCatalogs(state.vocabularies);
  } catch (e) {
    state.vocabularies = { allergens: [], diets: [] };
    exposeCatalogs(state.vocabularies);
  }
  if (state.user && state.tokens) {
    try {
      const me = await api('/auth/me', { auth: true });
      state.user = me.user;
      saveSession({ user: state.user, tokens: state.tokens });
    } catch (e) {
      state.user = null;
      state.tokens = null;
      saveSession(null);
    }
  }
  renderSession();
  emit();
}

function exposeCatalogs(vocabularies) {
  window.allergenCatalog = vocabularies?.allergens || [];
  window.dietCatalog = vocabularies?.diets || [];
}

function renderSession() {
  const slot = document.getElementById('session');
  if (!slot) return;
  if (state.user) {
    const initial = (state.user.publicName || '?').trim().charAt(0).toUpperCase();
    slot.innerHTML = `
      <a class="session-user" href="#/me">
        <span class="avatar small" style="background:${state.user.avatarColor || '#f97316'}">${escapeHtml(initial)}</span>
        <span class="hide-sm">${escapeHtml(state.user.publicName || '')}</span>
      </a>
      <button class="ghost" id="btn-logout">Salir</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => logout());
  } else {
    slot.innerHTML = `
      <a class="ghost-btn" href="#/login">Entrar</a>
      <a class="primary-btn" href="#/register">Crear cuenta</a>
    `;
  }
  document.getElementById('nav-create').hidden = !state.user;
}

export async function api(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (auth && state.tokens?.access) opts.headers.Authorization = `Bearer ${state.tokens.access}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (res.status === 204) return null;
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.message || 'Error en la solicitud');
    error.code = payload.code;
    error.details = payload.details;
    error.status = res.status;
    throw error;
  }
  return payload;
}

export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: { email, password } });
  state.user = data.user;
  state.tokens = data.tokens;
  saveSession({ user: data.user, tokens: data.tokens });
  renderSession();
  emit();
  return data.user;
}

export async function register({ email, password, publicName }) {
  const data = await api('/auth/register', { method: 'POST', body: { email, password, publicName } });
  state.user = data.user;
  state.tokens = data.tokens;
  saveSession({ user: data.user, tokens: data.tokens });
  renderSession();
  emit();
  return data.user;
}

export function logout() {
  const refresh = state.tokens?.refresh;
  state.user = null;
  state.tokens = null;
  saveSession(null);
  renderSession();
  emit();
  if (refresh) api('/auth/logout', { method: 'POST', body: { refreshToken: refresh } }).catch(() => {});
}

export async function updateMe(patch) {
  const data = await api('/auth/me', { method: 'PATCH', body: patch, auth: true });
  state.user = data.user;
  saveSession({ user: state.user, tokens: state.tokens });
  renderSession();
  emit();
  return data.user;
}

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

// Enrutador mínimo basado en hash.
const routes = [];
export function registerRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function navigate(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = `#${path}`;
  } else {
    renderRoute();
  }
}

function matchRoute(path) {
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) return { handler: route.handler, params: match.slice(1) };
  }
  return null;
}

export async function renderRoute() {
  const path = (window.location.hash || '#/').slice(1);
  const route = matchRoute(path);
  const view = document.getElementById('view');
  if (!route) {
    view.innerHTML = `<div class="empty"><strong>Página no encontrada</strong>Vuelve al <a href="#/">inicio</a>.</div>`;
    return;
  }
  state.activeView = path;
  document.querySelectorAll('.topnav a').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('href') === `#${path}`);
  });
  await route.handler(view, route.params);
  renderSession();
  emit();
}

window.addEventListener('hashchange', renderRoute);

// Registro de rutas (Inicio, búsqueda, detalle, crear receta, plan semanal, lista de compra, auth, perfil).
registerRoute(/^\/$/, renderFeed);
registerRoute(/^\/search$/, renderSearch);
registerRoute(/^\/recipes\/([^/]+)$/, renderRecipe);
registerRoute(/^\/create$/, renderCreateRecipe);
registerRoute(/^\/week$/, renderWeek);
registerRoute(/^\/shopping$/, renderShopping);
registerRoute(/^\/login$/, renderLogin);
registerRoute(/^\/register$/, renderRegister);
registerRoute(/^\/me$/, renderMe);
registerRoute(/^\/users\/([^/]+)$/, renderUserProfile);

bootstrap().then(() => renderRoute());