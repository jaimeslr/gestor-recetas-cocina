// Vista de feed (Inicio): feed cronológico y feed "seguidos".
import { api, getSession } from '../app.js';

const FEED_SCOPES = [
  { id: 'cronologico', label: 'Para ti' },
  { id: 'seguidos', label: 'Siguiendo' },
];

const state = {
  scope: 'cronologico',
  items: [],
  loading: false,
  error: null,
};

export async function renderFeed(view) {
  const session = getSession();
  view.innerHTML = `
    <section class="feed">
      <div class="section-title">
        <h2>Tu feed</h2>
        <div class="feed-tabs" role="tablist">
          ${FEED_SCOPES.map((s) => `
            <button class="tab ${state.scope === s.id ? 'active' : ''}" data-scope="${s.id}" role="tab">
              ${s.label}
            </button>
          `).join('')}
        </div>
      </div>
      <div id="feed-grid" class="grid"></div>
      <p id="feed-status" class="empty" aria-live="polite"></p>
    </section>
  `;

  view.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scope = btn.dataset.scope;
      if (scope === state.scope) return;
      state.scope = scope;
      state.items = [];
      view.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.scope === scope));
      loadFeed();
    });
  });

  await loadFeed();
}

async function loadFeed() {
  const session = getSession();
  const grid = document.getElementById('feed-grid');
  const status = document.getElementById('feed-status');

  if (state.scope === 'seguidos' && !session.user) {
    state.items = [];
    grid.innerHTML = '';
    status.innerHTML = `
      <strong>Inicia sesión para ver a quién sigues</strong>
      Te mostraremos aquí las recetas de las personas que sigas.
    `;
    return;
  }

  state.loading = true;
  status.textContent = 'Cargando recetas...';
  grid.innerHTML = '';

  try {
    const params = new URLSearchParams({ scope: state.scope, limit: '20' });
    const data = await api(`/feed?${params.toString()}`, { auth: !!session.tokens });
    state.items = data.recipes || [];
    renderGrid(grid, status);
  } catch (err) {
    state.error = err.message;
    status.innerHTML = `<strong>No hemos podido cargar el feed</strong>${escapeHtml(err.message)}`;
  } finally {
    state.loading = false;
  }
}

function renderGrid(grid, status) {
  if (!state.items.length) {
    grid.innerHTML = '';
    status.innerHTML = state.scope === 'seguidos'
      ? `<strong>Aún no sigues a nadie</strong>Pulsa "Seguir" en una receta o perfil para empezar.`
      : `<strong>Aún no hay recetas</strong>Vuelve cuando alguien publique algo delicioso.`;
    return;
  }
  status.textContent = '';
  grid.innerHTML = state.items.map(cardMarkup).join('');
  grid.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      window.location.hash = `#/recipes/${el.dataset.id}`;
    });
  });
}

function cardMarkup(recipe) {
  const tags = [
    ...recipe.diets.map((id) => `<span class="tag diet">${dietName(id)}</span>`),
    ...recipe.allergens.map((id) => `<span class="tag warn">${allergenName(id)}</span>`),
  ].join('');
  const rating = recipe.ratingCount
    ? `★ ${recipe.ratingAvg.toFixed(1)} (${recipe.ratingCount})`
    : 'Sin valorar';
  const author = recipe.author?.publicName || 'Anónimo';
  return `
    <article class="card" data-id="${recipe.id}">
      <img src="${recipe.imageUrl}" alt="${escapeAttr(recipe.title)}" loading="lazy" />
      <div class="card-body">
        <h3>${escapeHtml(recipe.title)}</h3>
        <p class="meta">Por ${escapeHtml(author)} · ${recipe.totalMinutes} min · ${recipe.servings} rac.</p>
        <p class="desc">${escapeHtml(recipe.description || '')}</p>
        <p class="meta">${rating}</p>
        <div class="tags">${tags}</div>
      </div>
    </article>
  `;
}

function dietName(id) {
  const diet = (window.dietCatalog || []).find((d) => d.id === id);
  return diet ? diet.name : id;
}

function allergenName(id) {
  const allergen = (window.allergenCatalog || []).find((a) => a.id === id);
  return allergen ? allergen.name : id;
}

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
