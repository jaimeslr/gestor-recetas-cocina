// Vista de plan semanal: cuadrícula 7 días × 4 comidas con asignación de recetas.
import { api, getSession } from '../app.js';

const DAYS = [
  { id: 'lunes', label: 'Lunes' },
  { id: 'martes', label: 'Martes' },
  { id: 'miercoles', label: 'Miércoles' },
  { id: 'jueves', label: 'Jueves' },
  { id: 'viernes', label: 'Viernes' },
  { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
];

const MEALS = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'comida', label: 'Comida' },
  { id: 'cena', label: 'Cena' },
  { id: 'snack', label: 'Snack' },
];

const state = {
  session: null,
  monday: null,
  plan: null,
  loading: false,
  picker: null,
};

export async function renderWeek(view) {
  const session = getSession();
  state.session = session;

  if (!session.user) {
    view.innerHTML = `
      <div class="empty">
        <strong>Inicia sesión para planificar tu semana</strong>
        <a href="#/login">Entrar</a> o <a href="#/register">crear cuenta</a>.
      </div>
    `;
    return;
  }

  view.innerHTML = `
    <section class="week">
      <div class="section-title">
        <h2>Mi semana</h2>
        <div class="row" style="display:flex; gap:0.5rem; align-items:center;">
          <button class="ghost" id="btn-prev-week" aria-label="Semana anterior">← Semana</button>
          <span id="week-label" class="meta"></span>
          <button class="ghost" id="btn-next-week" aria-label="Semana siguiente">Semana →</button>
          <button class="ghost" id="btn-today">Hoy</button>
          <a class="primary-btn" href="#/shopping">Lista de compra</a>
        </div>
      </div>
      <p id="week-status" class="empty" aria-live="polite">Cargando plan...</p>
      <div class="week-grid" id="week-grid"></div>
    </section>
  `;

  view.querySelector('#btn-prev-week').addEventListener('click', () => moveWeek(view, -7));
  view.querySelector('#btn-next-week').addEventListener('click', () => moveWeek(view, 7));
  view.querySelector('#btn-today').addEventListener('click', () => {
    state.monday = null;
    loadWeek(view);
  });

  await loadWeek(view);
}

async function loadWeek(view) {
  const status = view.querySelector('#week-status');
  const grid = view.querySelector('#week-grid');
  state.loading = true;
  status.textContent = 'Cargando plan...';
  grid.innerHTML = '';

  const params = new URLSearchParams();
  if (state.monday) params.set('monday', state.monday);
  try {
    const data = await api(`/me/week?${params.toString()}`, { auth: true });
    state.plan = data.plan;
    state.monday = state.plan.monday;
    renderGrid(view);
  } catch (err) {
    status.innerHTML = `<strong>No hemos podido cargar tu plan</strong>${escapeHtml(err.message)}`;
  } finally {
    state.loading = false;
  }
}

function renderGrid(view) {
  const grid = view.querySelector('#week-grid');
  const status = view.querySelector('#week-status');
  const label = view.querySelector('#week-label');
  label.textContent = formatWeekLabel(state.monday);

  const head = `
    <div class="label"></div>
    ${DAYS.map((d) => `<div class="label">${d.label}</div>`).join('')}
  `;

  const rows = MEALS.map((meal) => `
    <div class="label">${meal.label}</div>
    ${DAYS.map((day) => {
      const entry = entryFor(day.id, meal.id);
      return `
        <div class="cell" data-day="${day.id}" data-meal="${meal.id}">
          ${entry ? entryMarkup(entry) : `<div class="empty-slot">+ Asignar</div>`}
        </div>
      `;
    }).join('')}
  `).join('');

  grid.innerHTML = head + rows;
  status.textContent = '';

  grid.querySelectorAll('.cell').forEach((cell) => {
    cell.addEventListener('click', () => openPicker({
      day: cell.dataset.day,
      meal: cell.dataset.meal,
      view,
    }));
  });
}

function entryFor(day, meal) {
  if (!state.plan) return null;
  return state.plan.entries.find((e) => e.day === day && e.meal === meal) || null;
}

function entryMarkup(entry) {
  return `
    <div class="recipe" data-entry-id="${entry.entryId}">
      <span class="title">${escapeHtml(entry.recipe.title)}</span>
      <span class="meta">${entry.servings} rac.</span>
    </div>
    <div class="cell-actions">
      <button class="ghost" data-action="servings" data-entry-id="${entry.entryId}">Raciones</button>
      <button class="ghost" data-action="remove" data-entry-id="${entry.entryId}">Quitar</button>
    </div>
  `;
}

async function moveWeek(view, deltaDays) {
  const base = new Date(state.monday || currentMonday());
  base.setDate(base.getDate() + deltaDays);
  state.monday = base.toISOString().slice(0, 10);
  await loadWeek(view);
}

function currentMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(mondayIso) {
  if (!mondayIso) return '';
  const start = new Date(mondayIso);
  const end = new Date(mondayIso);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function openPicker({ day, meal, view }) {
  const cell = view.querySelector(`.cell[data-day="${day}"][data-meal="${meal}"]`);
  if (!cell) return;
  if (state.picker) state.picker.remove();

  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Elegir receta">
      <div class="modal-header">
        <h3>Elige una receta</h3>
        <button class="ghost" data-close aria-label="Cerrar">✕</button>
      </div>
      <div class="form">
        <label class="field">
          <span>Buscar</span>
          <input id="picker-q" type="search" placeholder="Receta, ingrediente..." />
        </label>
        <label class="field">
          <span>Raciones</span>
          <input id="picker-servings" type="number" min="1" max="20" value="4" />
        </label>
        <div id="picker-results" class="grid" style="max-height: 320px; overflow:auto;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  state.picker = dialog;

  const close = () => {
    dialog.remove();
    state.picker = null;
  };

  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  const input = dialog.querySelector('#picker-q');
  const results = dialog.querySelector('#picker-results');
  const servingsInput = dialog.querySelector('#picker-servings');

  async function runSearch(query) {
    results.innerHTML = '<p class="empty">Buscando...</p>';
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    try {
      const data = await api(`/search?${params.toString()}`, { auth: true });
      const list = data.recipes || [];
      if (!list.length) {
        results.innerHTML = '<p class="empty">No hay recetas disponibles.</p>';
        return;
      }
      results.innerHTML = list.map((r) => `
        <article class="card" data-id="${r.id}">
          <img src="${r.imageUrl}" alt="${escapeAttr(r.title)}" loading="lazy" />
          <div class="card-body">
            <h3>${escapeHtml(r.title)}</h3>
            <p class="meta">${r.totalMinutes} min · ${r.servings} rac.</p>
          </div>
        </article>
      `).join('');
      results.querySelectorAll('.card').forEach((el) => {
        el.addEventListener('click', async () => {
          const servings = Math.max(1, Math.min(20, Number(servingsInput.value) || 1));
          try {
            await api('/me/week/entries', {
              method: 'POST',
              auth: true,
              body: {
                monday: state.monday,
                day,
                meal,
                recipeId: el.dataset.id,
                servings,
              },
            });
            close();
            await loadWeek(view);
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      results.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
    }
  }

  input.addEventListener('input', () => runSearch(input.value.trim()));
  runSearch('');
}

async function changeServings(entryId, view) {
  const entry = state.plan.entries.find((e) => e.entryId === entryId);
  if (!entry) return;
  const next = prompt('Raciones (1–20):', String(entry.servings));
  if (next == null) return;
  const servings = Number(next);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) {
    alert('Raciones inválidas');
    return;
  }
  try {
    await api(`/me/week/entries/${entryId}`, {
      method: 'PATCH',
      auth: true,
      body: { monday: state.monday, servings },
    });
    await loadWeek(view);
  } catch (err) {
    alert(err.message);
  }
}

async function removeEntry(entryId, view) {
  if (!confirm('¿Quitar esta receta del plan?')) return;
  try {
    await api(`/me/week/entries/${entryId}?monday=${state.monday}`, { method: 'DELETE', auth: true });
    await loadWeek(view);
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const view = document.querySelector('.week');
  if (!view) return;
  const entryId = btn.dataset.entryId;
  if (btn.dataset.action === 'servings') {
    e.stopPropagation();
    changeServings(entryId, view);
  }
  if (btn.dataset.action === 'remove') {
    e.stopPropagation();
    removeEntry(entryId, view);
  }
});

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
