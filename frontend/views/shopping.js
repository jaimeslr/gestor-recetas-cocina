// Vista de lista de compra: genera la lista consolidada de la semana y permite marcar productos.
import { api, getSession } from '../app.js';

const state = {
  session: null,
  monday: null,
  items: [],
  checked: new Set(),
};

export async function renderShopping(view) {
  const session = getSession();
  state.session = session;

  if (!session.user) {
    view.innerHTML = `
      <div class="empty">
        <strong>Inicia sesión para generar tu lista</strong>
        <a href="#/login">Entrar</a> o <a href="#/register">crear cuenta</a>.
      </div>
    `;
    return;
  }

  view.innerHTML = `
    <section class="shopping">
      <div class="section-title">
        <h2>Lista de compra</h2>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <label class="meta" for="shopping-monday">Semana (lunes):</label>
          <input id="shopping-monday" type="date" />
          <button class="ghost" id="btn-today">Hoy</button>
          <button class="primary" id="btn-generate">Generar lista</button>
          <button class="ghost" id="btn-print">Imprimir</button>
          <button class="ghost" id="btn-clear">Vaciar marcados</button>
        </div>
      </div>
      <p id="shopping-status" class="empty" aria-live="polite">Cargando tu lista...</p>
      <ul id="shopping-list" class="list"></ul>
    </section>
  `;

  const date = view.querySelector('#shopping-monday');
  if (!state.monday) state.monday = currentMonday();
  date.value = state.monday;
  date.addEventListener('change', () => {
    state.monday = date.value || currentMonday();
    generate(view);
  });

  view.querySelector('#btn-today').addEventListener('click', () => {
    state.monday = currentMonday();
    date.value = state.monday;
    generate(view);
  });

  view.querySelector('#btn-generate').addEventListener('click', () => generate(view));
  view.querySelector('#btn-print').addEventListener('click', () => printList());
  view.querySelector('#btn-clear').addEventListener('click', () => {
    state.checked.clear();
    persistChecked();
    renderList(view);
  });

  await generate(view);
}

async function generate(view) {
  const status = view.querySelector('#shopping-status');
  const list = view.querySelector('#shopping-list');
  status.textContent = 'Generando lista...';
  list.innerHTML = '';
  try {
    const data = await api('/me/shopping-list', {
      method: 'POST',
      auth: true,
      body: { monday: state.monday },
    });
    state.items = data.items || [];
    loadChecked();
    if (!state.items.length) {
      status.innerHTML = `<strong>No hay nada que comprar</strong>Planifica tu semana para generar la lista.`;
      list.innerHTML = '';
      return;
    }
    status.textContent = `${state.items.length} productos para la semana del ${formatDate(state.monday)}`;
    renderList(view);
  } catch (err) {
    status.innerHTML = `<strong>No hemos podido generar la lista</strong>${escapeHtml(err.message)}`;
  }
}

function renderList(view) {
  const list = view.querySelector('#shopping-list');
  if (!state.items.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = state.items.map((item) => `
    <li class="${state.checked.has(itemKey(item)) ? 'checked' : ''}">
      <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; flex:1;">
        <input type="checkbox" data-key="${escapeAttr(itemKey(item))}" ${state.checked.has(itemKey(item)) ? 'checked' : ''} />
        <span>${escapeHtml(item.name)}</span>
      </label>
      <span class="meta">${escapeHtml(item.label || `${item.quantity} ${item.unit}`)}</span>
    </li>
  `).join('');
  list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.key;
      if (cb.checked) state.checked.add(key);
      else state.checked.delete(key);
      persistChecked();
      cb.closest('li').classList.toggle('checked', cb.checked);
    });
  });
}

function itemKey(item) {
  return `${item.name.toLowerCase().trim()}|${item.unit}`;
}

function currentMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

const CHECK_KEY = 'recetas-shopping-checked';

function loadChecked() {
  try {
    const raw = localStorage.getItem(CHECK_KEY);
    if (!raw) {
      state.checked = new Set();
      return;
    }
    const parsed = JSON.parse(raw);
    state.checked = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    state.checked = new Set();
  }
}

function persistChecked() {
  try {
    localStorage.setItem(CHECK_KEY, JSON.stringify(Array.from(state.checked)));
  } catch {
    // Sin espacio: no bloqueamos.
  }
}

function printList() {
  const rows = state.items.map((item) => `
    <tr>
      <td style="padding:0.4rem 0.6rem; border-bottom:1px solid #eee;">${state.checked.has(itemKey(item)) ? '☑' : '☐'}</td>
      <td style="padding:0.4rem 0.6rem; border-bottom:1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding:0.4rem 0.6rem; border-bottom:1px solid #eee;">${escapeHtml(item.label || `${item.quantity} ${item.unit}`)}</td>
    </tr>
  `).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Lista de compra</title></head>
    <body style="font-family:Helvetica,Arial,sans-serif; padding:2rem;">
      <h1>Lista de compra</h1>
      <p>Semana del ${formatDate(state.monday)}</p>
      <table style="width:100%; border-collapse:collapse;">${rows}</table>
    </body></html>`;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  } else {
    alert('Permite ventanas emergentes para imprimir.');
  }
}

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
