// Vistas de perfil: propio (#/me) y público (#/users/:id).
import { api, getSession, updateMe } from '../app.js';

const COVER_PALETTES = [
  ['#fde68a', '#f97316'],
  ['#bbf7d0', '#10b981'],
  ['#bae6fd', '#0ea5e9'],
  ['#fbcfe8', '#ec4899'],
  ['#ddd6fe', '#6366f1'],
  ['#fef3c7', '#f59e0b'],
];

export async function renderMe(view) {
  const session = getSession();
  if (!session.user) {
    view.innerHTML = `
      <div class="empty">
        <strong>Inicia sesión para ver tu perfil</strong>
        <a href="#/login">Entrar</a> o <a href="#/register">crear cuenta</a>.
      </div>
    `;
    return;
  }

  view.innerHTML = `
    <section class="profile">
      <div id="profile-banner" class="profile-banner"></div>
      <div class="profile-header">
        <div class="avatar" id="me-avatar" style="background:${session.user.avatarColor || '#f97316'}">${escapeHtml(initial(session.user.publicName))}</div>
        <div style="flex:1; min-width: 220px;">
          <h1 style="margin:0;">${escapeHtml(session.user.publicName)}</h1>
          <p class="meta" id="me-bio">${escapeHtml(session.user.bio || '')}</p>
          <p class="meta">
            <span id="me-followers">${session.user.followers || 0}</span> seguidores ·
            <span id="me-following">${session.user.following || 0}</span> seguidos
          </p>
        </div>
        <div class="actions">
          <button class="ghost" id="btn-edit-profile">Editar perfil</button>
          <a class="ghost-btn" href="#/create">Publicar receta</a>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="recipes">Mis recetas</button>
        <button class="tab" data-tab="collections">Colecciones</button>
        <button class="tab" data-tab="saved">Guardados</button>
      </div>

      <div id="tab-content"></div>
    </section>
  `;

  const [bg, accent] = COVER_PALETTES[hash(session.user.id)];
  const banner = view.querySelector('#profile-banner');
  banner.style.background = `linear-gradient(135deg, ${bg}, ${accent})`;

  view.querySelector('#btn-edit-profile').addEventListener('click', () => openEditProfile(view));

  const tabs = view.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      loadTab(tab.dataset.tab, view);
    });
  });

  await loadTab('recipes', view);
}

async function loadTab(tab, view) {
  const slot = view.querySelector('#tab-content');
  slot.innerHTML = '<p class="empty">Cargando...</p>';
  try {
    if (tab === 'recipes') return renderMyRecipes(slot);
    if (tab === 'collections') return renderCollections(slot);
    if (tab === 'saved') return renderSaved(slot);
  } catch (err) {
    slot.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

async function renderMyRecipes(slot) {
  const session = getSession();
  const data = await api(`/users/${session.user.id}/recipes`);
  const recipes = data.recipes || [];
  if (!recipes.length) {
    slot.innerHTML = `<div class="empty"><strong>Aún no has publicado</strong><a href="#/create">Crea tu primera receta</a>.</div>`;
    return;
  }
  slot.innerHTML = `<div class="grid">${recipes.map(cardMarkup).join('')}</div>`;
  bindCards(slot);
}

async function renderCollections(slot) {
  const data = await api('/me/collections', { auth: true });
  const collections = data.collections || [];
  slot.innerHTML = `
    <div class="form">
      <form id="new-collection">
        <label class="field">
          <span>Nueva colección</span>
          <input id="new-collection-name" type="text" maxlength="40" placeholder="p. ej. Postres" required />
        </label>
        <button type="submit" class="primary">Crear</button>
      </form>
    </div>
    <ul id="collections-list" class="list" style="margin-top:1rem;"></ul>
  `;
  const list = slot.querySelector('#collections-list');
  list.innerHTML = collections.length
    ? collections.map((c) => `
      <li>
        <span>${escapeHtml(c.name)}</span>
        <div style="display:flex; gap:0.4rem;">
          <button class="ghost" data-rename="${c.id}">Cambiar nombre</button>
          <button class="ghost" data-remove="${c.id}">Borrar</button>
        </div>
      </li>
    `).join('')
    : `<li><span>Aún no tienes colecciones</span></li>`;
  slot.querySelector('#new-collection').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = slot.querySelector('#new-collection-name').value.trim();
    if (!name) return;
    try {
      await api('/me/collections', { method: 'POST', body: { name }, auth: true });
      slot.querySelector('#new-collection-name').value = '';
      await renderCollections(slot);
    } catch (err) {
      alert(err.message);
    }
  });
  list.querySelectorAll('[data-rename]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rename;
      const current = collections.find((c) => c.id === id);
      const next = prompt('Nuevo nombre', current?.name || '');
      if (!next || !next.trim()) return;
      try {
        await api(`/me/collections/${id}`, { method: 'PATCH', body: { name: next.trim() }, auth: true });
        await renderCollections(slot);
      } catch (err) {
        alert(err.message);
      }
    });
  });
  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.remove;
      if (!confirm('¿Borrar esta colección?')) return;
      try {
        await api(`/me/collections/${id}`, { method: 'DELETE', auth: true });
        await renderCollections(slot);
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderSaved(slot) {
  const data = await api('/me/saved', { auth: true });
  const saved = (data.saved || []).filter((s) => s.recipe);
  if (!saved.length) {
    slot.innerHTML = `<div class="empty"><strong>No tienes guardados</strong>Usa el botón "Guardar" en una receta.</div>`;
    return;
  }
  slot.innerHTML = saved.map((s) => `
    <article class="card" data-id="${s.recipe.id}">
      <img src="${s.recipe.imageUrl}" alt="${escapeAttr(s.recipe.title)}" loading="lazy" />
      <div class="card-body">
        <h3>${escapeHtml(s.recipe.title)}</h3>
        <p class="meta">${escapeHtml(s.collection?.name || 'Sin colección')} · ${s.recipe.totalMinutes} min</p>
      </div>
    </article>
  `).join('');
  bindCards(slot);
}

function bindCards(slot) {
  slot.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => {
      window.location.hash = `#/recipes/${el.dataset.id}`;
    });
  });
}

function openEditProfile(view) {
  const session = getSession();
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Editar perfil">
      <div class="modal-header">
        <h3>Editar perfil</h3>
        <button class="ghost" data-close aria-label="Cerrar">✕</button>
      </div>
      <form id="edit-profile" class="form">
        <label class="field"><span>Nombre público</span>
          <input id="ep-name" maxlength="40" value="${escapeAttr(session.user.publicName || '')}" required />
        </label>
        <label class="field"><span>Bio (máx. 200)</span>
          <textarea id="ep-bio" maxlength="200">${escapeHtml(session.user.bio || '')}</textarea>
        </label>
        <label class="field"><span>País</span>
          <input id="ep-country" maxlength="40" value="${escapeAttr(session.user.country || '')}" />
        </label>
        <label class="field"><span>Color de avatar</span>
          <input id="ep-color" type="color" value="${escapeAttr(session.user.avatarColor || '#f97316')}" />
        </label>
        <p id="ep-error" class="alert" hidden></p>
        <button class="primary" type="submit">Guardar</button>
      </form>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
  dialog.querySelector('#edit-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = dialog.querySelector('#ep-error');
    err.hidden = true;
    try {
      await updateMe({
        publicName: dialog.querySelector('#ep-name').value.trim(),
        bio: dialog.querySelector('#ep-bio').value.slice(0, 200),
        country: dialog.querySelector('#ep-country').value.trim() || null,
        avatarColor: dialog.querySelector('#ep-color').value,
      });
      dialog.remove();
      await renderMe(view);
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    }
  });
}

export async function renderUserProfile(view, params) {
  const id = params[0];
  const session = getSession();
  const data = await api(`/users/${id}`);
  const user = data.user;
  if (!user) {
    view.innerHTML = `<div class="empty"><strong>Persona no encontrada</strong></div>`;
    return;
  }
  const [bg, accent] = COVER_PALETTES[hash(user.id)];
  view.innerHTML = `
    <section class="profile">
      <div class="profile-banner" style="background: linear-gradient(135deg, ${bg}, ${accent});"></div>
      <div class="profile-header">
        <div class="avatar" style="background:${user.avatarColor || '#f97316'}">${escapeHtml(initial(user.publicName))}</div>
        <div style="flex:1; min-width: 220px;">
          <h1 style="margin:0;">${escapeHtml(user.publicName)}</h1>
          <p class="meta">${escapeHtml(user.bio || '')}</p>
          <p class="meta">${user.followers} seguidores · ${user.following} siguientes</p>
        </div>
        <div class="actions">
          ${session.user && session.user.id !== user.id
            ? `<button class="primary" id="btn-follow">${user.isFollowing ? 'Dejar de seguir' : 'Seguir'}</button>`
            : ''}
        </div>
      </div>
      <div id="user-recipes" class="grid"></div>
    </section>
  `;
  const followBtn = view.querySelector('#btn-follow');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      try {
        if (user.isFollowing) {
          await api(`/users/${user.id}/follow`, { method: 'DELETE', auth: true });
          user.isFollowing = false;
          user.followers = Math.max(0, user.followers - 1);
        } else {
          await api(`/users/${user.id}/follow`, { method: 'POST', auth: true });
          user.isFollowing = true;
          user.followers += 1;
        }
        followBtn.textContent = user.isFollowing ? 'Dejar de seguir' : 'Seguir';
        view.querySelector('.profile-header .meta:last-child').textContent =
          `${user.followers} seguidores · ${user.following} siguientes`;
      } catch (err) {
        alert(err.message);
      }
    });
  }
  const data2 = await api(`/users/${user.id}/recipes`);
  const recipes = data2.recipes || [];
  const slot = view.querySelector('#user-recipes');
  if (!recipes.length) {
    slot.innerHTML = `<div class="empty"><strong>Sin recetas todavía</strong></div>`;
    return;
  }
  slot.innerHTML = recipes.map(cardMarkup).join('');
  slot.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => {
      window.location.hash = `#/recipes/${el.dataset.id}`;
    });
  });
}

function cardMarkup(recipe) {
  const tags = [
    ...recipe.diets.map((id) => `<span class="tag diet">${lookupDiet(id)}</span>`),
    ...recipe.allergens.map((id) => `<span class="tag warn">${lookupAllergen(id)}</span>`),
  ].join('');
  return `
    <article class="card" data-id="${recipe.id}">
      <img src="${recipe.imageUrl}" alt="${escapeAttr(recipe.title)}" loading="lazy" />
      <div class="card-body">
        <h3>${escapeHtml(recipe.title)}</h3>
        <p class="meta">${recipe.totalMinutes} min · ${recipe.servings} rac.</p>
        <p class="desc">${escapeHtml(recipe.description || '')}</p>
        <div class="tags">${tags}</div>
      </div>
    </article>
  `;
}

function hash(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % COVER_PALETTES.length;
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function lookupDiet(id) {
  const d = (window.dietCatalog || []).find((x) => x.id === id);
  return d ? d.name : id;
}

function lookupAllergen(id) {
  const a = (window.allergenCatalog || []).find((x) => x.id === id);
  return a ? a.name : id;
}

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
