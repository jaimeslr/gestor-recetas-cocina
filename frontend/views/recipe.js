// Vista de detalle de receta: ingredientes, pasos, comentarios y relacionadas.
import { api, getSession } from '../app.js';

const state = {
  recipe: null,
  comments: [],
  related: [],
  loading: false,
  error: null,
  saving: false,
  ratingPending: false,
};

export async function renderRecipe(view, params) {
  const id = params[0];
  if (!id) {
    view.innerHTML = `<div class="empty"><strong>Receta no encontrada</strong>Vuelve al <a href="#/">inicio</a>.</div>`;
    return;
  }

  view.innerHTML = `
    <section class="detail" id="recipe-detail">
      <p class="empty">Cargando receta...</p>
    </section>
  `;

  await loadRecipe(view, id);
  bindGlobalActions(view, id);
}

async function loadRecipe(view, id) {
  const session = getSession();
  const detail = document.getElementById('recipe-detail');
  state.loading = true;
  state.error = null;
  try {
    const [recipe, comments, related] = await Promise.all([
      api(`/recipes/${id}`, { auth: !!session.tokens }),
      api(`/recipes/${id}/comments`),
      api(`/recipes/${id}/related`).catch(() => ({ recipes: [] })),
    ]);
    state.recipe = recipe;
    state.comments = comments.comments || [];
    state.related = related.recipes || [];
    renderDetail(view);
  } catch (err) {
    detail.innerHTML = `
      <div class="empty">
        <strong>No hemos podido cargar la receta</strong>
        ${escapeHtml(err.message)}
      </div>
    `;
  } finally {
    state.loading = false;
  }
}

function renderDetail(view) {
  const recipe = state.recipe;
  if (!recipe) return;
  const session = getSession();
  const isAuthor = session.user?.id === recipe.author?.id;
  const tags = [
    ...recipe.diets.map((id) => `<span class="tag diet">${lookupDiet(id)}</span>`),
    ...recipe.allergens.map((id) => `<span class="tag warn">${lookupAllergen(id)}</span>`),
  ].join('');
  const rating = recipe.ratingCount
    ? `★ ${recipe.ratingAvg.toFixed(1)} · ${recipe.ratingCount} valoraciones`
    : 'Aún sin valorar';

  view.innerHTML = `
    <article class="detail">
      <img class="hero-img" src="${recipe.imageUrl}" alt="${escapeAttr(recipe.title)}" />
      <header class="head">
        <div>
          <h1>${escapeHtml(recipe.title)}</h1>
          <p class="meta">
            Por <a href="#/users/${recipe.author?.id || ''}">${escapeHtml(recipe.author?.publicName || 'Anónimo')}</a>
            · ${rating}
            · ${recipe.totalMinutes} min
            · ${recipe.difficulty}
            · ${recipe.servings} rac.
          </p>
          <div class="tags">${tags}</div>
        </div>
        <div class="actions">
          <button class="primary" id="btn-save">${recipe.savedIn?.length ? 'Guardada' : 'Guardar'}</button>
          <button class="ghost" id="btn-share">Compartir</button>
          ${isAuthor ? `<button class="ghost" id="btn-edit">Editar</button>` : ''}
        </div>
      </header>

      <div class="columns">
        <section>
          <h2>Ingredientes</h2>
          <ul class="list">
            ${recipe.ingredients.map((ing) => `
              <li>
                <span>${escapeHtml(ing.name)}</span>
                <span class="meta">${formatQty(ing.quantity)} ${ing.unit}</span>
              </li>
            `).join('')}
          </ul>
        </section>
        <section>
          <h2>Pasos</h2>
          ${recipe.steps.map((step, idx) => `
            <div class="recipe-step">
              <span class="ord">${idx + 1}</span>
              <p>${escapeHtml(step.text)}</p>
            </div>
          `).join('')}
        </section>
      </div>

      <section class="rating">
        <h2>Tu valoración</h2>
        <div id="rating-stars" role="radiogroup" aria-label="Valorar receta">
          ${[1, 2, 3, 4, 5].map((n) => `
            <button class="star ${recipe.userRating && recipe.userRating >= n ? 'on' : ''}" data-stars="${n}" aria-label="${n} estrellas">★</button>
          `).join('')}
        </div>
      </section>

      <section class="comments">
        <h2>Comentarios (${recipe.commentCount || 0})</h2>
        ${session.user ? `
          <form id="comment-form" class="form">
            <label class="field">
              <span>Escribe un comentario</span>
              <textarea name="text" maxlength="500" required></textarea>
            </label>
            <button class="primary" type="submit">Publicar</button>
          </form>
        ` : `<p class="empty"><a href="#/login">Inicia sesión</a> para comentar.</p>`}
        <div id="comments-list">
          ${state.comments.map(commentMarkup).join('') || '<p class="empty">Sé la primera persona en comentar.</p>'}
        </div>
      </section>

      ${state.related.length ? `
        <section>
          <h2>Recetas relacionadas</h2>
          <div class="grid">
            ${state.related.map(relatedCard).join('')}
          </div>
        </section>
      ` : ''}
    </article>
  `;

  bindRecipeActions(view);
}

function bindGlobalActions(view, id) {
  // Acciones que necesitan persistir entre re-renderizados se atan en bindRecipeActions.
  void view;
  void id;
}

function bindRecipeActions(view) {
  const session = getSession();
  const recipe = state.recipe;
  if (!recipe) return;

  const saveBtn = view.querySelector('#btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveRecipe(saveBtn));
  }

  const shareBtn = view.querySelector('#btn-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => shareRecipe(recipe));
  }

  const editBtn = view.querySelector('#btn-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      window.location.hash = `#/recipes/${recipe.id}/edit`;
    });
  }

  const form = view.querySelector('#comment-form');
  if (form) {
    form.addEventListener('submit', (e) => submitComment(e, view));
  }

  view.querySelectorAll('#rating-stars .star').forEach((btn) => {
    btn.addEventListener('click', () => rateRecipe(Number(btn.dataset.stars), view));
  });

  view.querySelectorAll('[data-reply-id]').forEach((btn) => {
    btn.addEventListener('click', () => showReply(btn.dataset.replyId, view));
  });

  view.querySelectorAll('.related-card').forEach((el) => {
    el.addEventListener('click', () => {
      window.location.hash = `#/recipes/${el.dataset.id}`;
    });
  });

  void session;
}

async function saveRecipe(btn) {
  const session = getSession();
  if (!session.user) {
    window.location.hash = '#/login';
    return;
  }
  if (state.saving) return;
  state.saving = true;
  const wasSaved = state.recipe.savedIn?.length > 0;
  btn.disabled = true;
  try {
    if (wasSaved) {
      await api(`/recipes/${state.recipe.id}/save?collectionId=${state.recipe.savedIn[0].id}`, {
        method: 'DELETE',
        auth: true,
      });
      state.recipe.savedIn = [];
      btn.textContent = 'Guardar';
    } else {
      await api(`/recipes/${state.recipe.id}/save`, { method: 'POST', auth: true, body: {} });
      state.recipe.savedIn = [{ id: 'favoritas', name: 'Favoritas' }];
      btn.textContent = 'Guardada';
    }
  } catch (err) {
    alert(err.message);
  } finally {
    state.saving = false;
    btn.disabled = false;
  }
}

function shareRecipe(recipe) {
  const url = `${window.location.origin}/#/recipes/${recipe.id}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => alert('Enlace copiado al portapapeles'),
      () => prompt('Copia este enlace', url),
    );
  } else {
    prompt('Copia este enlace', url);
  }
}

async function submitComment(e, view) {
  e.preventDefault();
  const form = e.currentTarget;
  const text = form.text.value.trim();
  if (!text) return;
  try {
    const data = await api(`/recipes/${state.recipe.id}/comments`, {
      method: 'POST',
      auth: true,
      body: { text },
    });
    state.comments = [...state.comments, { ...data.comment, author: getSession().user, replies: [] }];
    state.recipe.commentCount = (state.recipe.commentCount || 0) + 1;
    renderDetail(view);
  } catch (err) {
    alert(err.message);
  }
}

function showReply(parentId, view) {
  const section = view.querySelector(`#comment-${parentId}`);
  if (!section) return;
  const existing = section.querySelector('form.reply-form');
  if (existing) {
    existing.remove();
    return;
  }
  const form = document.createElement('form');
  form.className = 'form reply-form';
  form.innerHTML = `
    <label class="field">
      <span>Responder</span>
      <textarea name="text" maxlength="500" required></textarea>
    </label>
    <button class="primary" type="submit">Publicar respuesta</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    try {
      const data = await api(`/recipes/${state.recipe.id}/comments`, {
        method: 'POST',
        auth: true,
        body: { text, parentId },
      });
      const parent = state.comments.find((c) => c.id === parentId);
      if (parent) parent.replies = [...(parent.replies || []), { ...data.comment, author: getSession().user }];
      renderDetail(view);
    } catch (err) {
      alert(err.message);
    }
  });
  section.appendChild(form);
}

async function rateRecipe(stars, view) {
  const session = getSession();
  if (!session.user) {
    window.location.hash = '#/login';
    return;
  }
  if (state.ratingPending) return;
  state.ratingPending = true;
  try {
    const data = await api(`/recipes/${state.recipe.id}/rate`, {
      method: 'POST',
      auth: true,
      body: { stars },
    });
    state.recipe = data.recipe;
    renderDetail(view);
  } catch (err) {
    alert(err.message);
  } finally {
    state.ratingPending = false;
  }
}

function commentMarkup(comment) {
  return `
    <div class="comment" id="comment-${comment.id}">
      <p class="who">${escapeHtml(comment.author?.publicName || 'Anónimo')}</p>
      <p>${escapeHtml(comment.text)}</p>
      <p class="when">${formatDate(comment.createdAt)}</p>
      <button class="ghost" data-reply-id="${comment.id}">Responder</button>
      ${comment.replies && comment.replies.length ? `
        <div class="replies">
          ${comment.replies.map((r) => `
            <div class="comment reply">
              <p class="who">${escapeHtml(r.author?.publicName || 'Anónimo')}</p>
              <p>${escapeHtml(r.text)}</p>
              <p class="when">${formatDate(r.createdAt)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function relatedCard(recipe) {
  return `
    <article class="card related-card" data-id="${recipe.id}">
      <img src="${recipe.imageUrl}" alt="${escapeAttr(recipe.title)}" loading="lazy" />
      <div class="card-body">
        <h3>${escapeHtml(recipe.title)}</h3>
        <p class="meta">${recipe.totalMinutes} min · ${recipe.servings} rac.</p>
      </div>
    </article>
  `;
}

function formatQty(value) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
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
