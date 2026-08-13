// Vista de búsqueda con filtros combinables: alérgenos a evitar, dietas, tiempo, dificultad, categoría y orden.
import { api, getSession } from '../app.js';

const DIFFICULTIES = [
  { id: 'facil', label: 'Fácil' },
  { id: 'media', label: 'Media' },
  { id: 'dificil', label: 'Difícil' },
];

const CATEGORIES = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'comida', label: 'Comida' },
  { id: 'cena', label: 'Cena' },
  { id: 'snack', label: 'Snack' },
  { id: 'postre', label: 'Postre' },
  { id: 'bebida', label: 'Bebida' },
  { id: 'salsa', label: 'Salsa' },
  { id: 'guarnicion', label: 'Guarnición' },
  { id: 'panaderia', label: 'Panadería' },
];

const SORTS = [
  { id: 'recientes', label: 'Más recientes' },
  { id: 'top', label: 'Mejor valoradas' },
  { id: 'masGuardadas', label: 'Más guardadas' },
];

const filters = {
  q: '',
  allergens: new Set(),
  diets: new Set(),
  maxTime: '',
  difficulty: '',
  category: '',
  sort: 'recientes',
};

let lastQuery = '';

export async function renderSearch(view) {
  view.innerHTML = `
    <section class="search">
      <div class="section-title">
        <h2>Buscar recetas</h2>
      </div>

      <form id="search-form" class="form" role="search">
        <label class="field">
          <span>Buscar por nombre, descripción o ingrediente</span>
          <input id="search-q" name="q" type="search" placeholder="p. ej. tortilla, pollo, quinoa" autocomplete="off" />
        </label>

        <fieldset class="filters-group">
          <legend>Alérgenos a evitar</legend>
          <p class="small">Excluimos cualquier receta que los declare.</p>
          <div id="filter-allergens" class="chips" role="group"></div>
        </fieldset>

        <fieldset class="filters-group">
          <legend>Dietas</legend>
          <div id="filter-diets" class="chips" role="group"></div>
        </fieldset>

        <div class="row">
          <label class="field">
            <span>Tiempo máximo (min)</span>
            <input id="search-time" name="maxTime" type="number" min="1" max="600" placeholder="sin límite" />
          </label>
          <label class="field">
            <span>Dificultad</span>
            <select id="search-difficulty" name="difficulty">
              <option value="">Cualquiera</option>
              ${DIFFICULTIES.map((d) => `<option value="${d.id}">${d.label}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Categoría</span>
            <select id="search-category" name="category">
              <option value="">Cualquiera</option>
              ${CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Ordenar por</span>
            <select id="search-sort" name="sort">
              ${SORTS.map((s) => `<option value="${s.id}" ${s.id === filters.sort ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="row">
          <button type="submit" class="primary">Buscar</button>
          <button type="button" class="ghost" id="search-reset">Limpiar filtros</button>
        </div>
      </form>

      <p id="search-status" class="empty" aria-live="polite"></p>
      <div id="search-grid" class="grid"></div>
    </section>
  `;

  renderAllergenChips(view);
  renderDietChips(view);

  view.querySelector('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    syncFiltersFromForm(view);
    runSearch(view);
  });

  view.querySelector('#search-reset').addEventListener('click', () => {
    filters.q = '';
    filters.allergens = new Set();
    filters.diets = new Set();
    filters.maxTime = '';
    filters.difficulty = '';
    filters.category = '';
    filters.sort = 'recientes';
    view.querySelector('#search-q').value = '';
    view.querySelector('#search-time').value = '';
    view.querySelector('#search-difficulty').value = '';
    view.querySelector('#search-category').value = '';
    view.querySelector('#search-sort').value = 'recientes';
    renderAllergenChips(view);
    renderDietChips(view);
    runSearch(view);
  });

  runSearch(view);
}

function renderAllergenChips(view) {
  const host = view.querySelector('#filter-allergens');
  const list = window.allergenCatalog || [];
  host.innerHTML = list
    .map(
      (a) => `
      <label class="chip ${filters.allergens.has(a.id) ? 'on' : ''}">
        <input type="checkbox" value="${a.id}" data-group="allergens" ${filters.allergens.has(a.id) ? 'checked' : ''} />
        ${a.name}
      </label>
    `
    )
    .join('');
}

function renderDietChips(view) {
  const host = view.querySelector('#filter-diets');
  const list = window.dietCatalog || [];
  host.innerHTML = list
    .map(
      (d) => `
      <label class="chip ${filters.diets.has(d.id) ? 'on' : ''}">
        <input type="checkbox" value="${d.id}" data-group="diets" ${filters.diets.has(d.id) ? 'checked' : ''} />
        ${d.name}
      </label>
    `
    )
    .join('');
}

function syncFiltersFromForm(view) {
  filters.q = view.querySelector('#search-q').value.trim();
  filters.maxTime = view.querySelector('#search-time').value.trim();
  filters.difficulty = view.querySelector('#search-difficulty').value;
  filters.category = view.querySelector('#search-category').value;
  filters.sort = view.querySelector('#search-sort').value || 'recientes';

  filters.allergens = new Set();
  filters.diets = new Set();
  view.querySelectorAll('.chip input[type="checkbox"]').forEach((cb) => {
    if (!cb.checked) return;
    if (cb.dataset.group === 'allergens') filters.allergens.add(cb.value);
    if (cb.dataset.group === 'diets') filters.diets.add(cb.value);
  });
}

async function runSearch(view) {
  const session = getSession();
  const status = view.querySelector('#search-status');
  const grid = view.querySelector('#search-grid');
  status.textContent = 'Buscando recetas...';
  grid.innerHTML = '';

  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.allergens.size) params.set('allergens', Array.from(filters.allergens).join(','));
  if (filters.diets.size) params.set('diets', Array.from(filters.diets).join(','));
  if (filters.maxTime) params.set('maxTime', filters.maxTime);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort) params.set('sort', filters.sort);

  lastQuery = params.toString();
  try {
    const data = await api(`/search?${lastQuery}`, { auth: !!session.tokens });
    const recipes = data.recipes || [];
    if (!recipes.length) {
      status.innerHTML = `<strong>Sin resultados</strong>Prueba a relajar los filtros o quitar algún alérgeno.`;
      return;
    }
    status.textContent = `${recipes.length} recetas encontradas`;
    grid.innerHTML = recipes.map(cardMarkup).join('');
    grid.querySelectorAll('.card').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#/recipes/${el.dataset.id}`;
      });
    });
  } catch (err) {
    status.innerHTML = `<strong>No hemos podido buscar</strong>${escapeHtml(err.message)}`;
  }
}

function cardMarkup(recipe) {
  const tags = [
    ...recipe.diets.map((id) => `<span class="tag diet">${lookupDiet(id)}</span>`),
    ...recipe.allergens.map((id) => `<span class="tag warn">${lookupAllergen(id)}</span>`),
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

function lookupDiet(id) {
  const diet = (window.dietCatalog || []).find((d) => d.id === id);
  return diet ? diet.name : id;
}

function lookupAllergen(id) {
  const allergen = (window.allergenCatalog || []).find((a) => a.id === id);
  return allergen ? allergen.name : id;
}

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
