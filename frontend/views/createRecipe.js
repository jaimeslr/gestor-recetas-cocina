// Asistente de creación de receta por pasos, con borrador en localStorage.
import { api, getSession } from '../app.js';

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

const DIFFICULTIES = [
  { id: 'facil', label: 'Fácil' },
  { id: 'media', label: 'Media' },
  { id: 'dificil', label: 'Difícil' },
];

const UNITS = ['g', 'kg', 'ml', 'l', 'ud', 'cdita', 'cdta', 'taza', 'pizca', 'diente', 'rebanada'];

const DRAFT_KEY = 'recetas-draft';

const STEPS = [
  { id: 'basics', title: 'Datos básicos' },
  { id: 'ingredients', title: 'Ingredientes' },
  { id: 'steps', title: 'Pasos' },
  { id: 'tags', title: 'Dietas y alérgenos' },
  { id: 'preview', title: 'Vista previa' },
];

const emptyDraft = () => ({
  title: '',
  description: '',
  category: 'comida',
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 4,
  difficulty: 'facil',
  diets: [],
  allergens: [],
  ingredients: [{ name: '', quantity: 100, unit: 'g' }],
  steps: [''],
  imagePrompt: '',
});

let draft = null;
let stepIndex = 0;

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw);
    return { ...emptyDraft(), ...parsed };
  } catch {
    return emptyDraft();
  }
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    // Sin espacio o sin localStorage. No bloqueamos el flujo.
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nada que hacer.
  }
}

export async function renderCreateRecipe(view) {
  const session = getSession();
  if (!session.user) {
    view.innerHTML = `
      <div class="empty">
        <strong>Inicia sesión para crear una receta</strong>
        <a href="#/login">Entrar</a> o <a href="#/register">crear cuenta</a>.
      </div>
    `;
    return;
  }

  if (!draft) draft = loadDraft();
  paintWizard(view);

  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (stepIndex > 0) {
      stepIndex -= 1;
      paintWizard(view);
    }
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (validateStep(stepIndex)) {
      saveDraft();
      stepIndex = Math.min(stepIndex + 1, STEPS.length - 1);
      paintWizard(view);
    }
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    saveDraft();
    alert('Borrador guardado en este navegador.');
  });

  document.getElementById('btn-publish')?.addEventListener('click', () => publishRecipe(view));
}

function paintWizard(view) {
  const step = STEPS[stepIndex];
  view.innerHTML = `
    <section class="create">
      <div class="section-title">
        <h2>Crear receta</h2>
        <p class="meta">${stepIndex + 1} de ${STEPS.length} · ${step.title}</p>
      </div>
      <ol class="stepper">
        ${STEPS.map(
          (s, i) => `<li class="${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}">${s.title}</li>`
        ).join('')}
      </ol>
      <div id="step-body" class="form"></div>
      <div class="form row" style="margin-top: 1rem;">
        <button type="button" class="ghost" id="btn-prev" ${stepIndex === 0 ? 'disabled' : ''}>Anterior</button>
        <button type="button" class="ghost" id="btn-save">Guardar borrador</button>
        <button type="button" class="primary" id="btn-next" ${stepIndex === STEPS.length - 1 ? 'hidden' : ''}>Siguiente</button>
        <button type="button" class="primary" id="btn-publish" ${stepIndex === STEPS.length - 1 ? '' : 'hidden'}>Publicar</button>
      </div>
      <p id="step-error" class="alert" hidden></p>
    </section>
  `;
  renderStepBody(view);
  bindStepEvents(view);
}

function renderStepBody(view) {
  const body = view.querySelector('#step-body');
  if (stepIndex === 0) body.innerHTML = basicsStep();
  if (stepIndex === 1) body.innerHTML = ingredientsStep();
  if (stepIndex === 2) body.innerHTML = stepsStep();
  if (stepIndex === 3) body.innerHTML = tagsStep();
  if (stepIndex === 4) body.innerHTML = previewStep();
}

function basicsStep() {
  return `
    <label class="field">
      <span>Título (5–80 caracteres)</span>
      <input id="f-title" type="text" maxlength="80" value="${escapeAttr(draft.title)}" />
    </label>
    <label class="field">
      <span>Descripción (máx. 500)</span>
      <textarea id="f-description" maxlength="500">${escapeHtml(draft.description)}</textarea>
    </label>
    <div class="row">
      <label class="field"><span>Categoría</span>
        <select id="f-category">
          ${CATEGORIES.map((c) => `<option value="${c.id}" ${draft.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Dificultad</span>
        <select id="f-difficulty">
          ${DIFFICULTIES.map((d) => `<option value="${d.id}" ${draft.difficulty === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="row">
      <label class="field"><span>Tiempo de preparación (min)</span>
        <input id="f-prep" type="number" min="0" max="1440" value="${draft.prepMinutes}" />
      </label>
      <label class="field"><span>Tiempo de cocción (min)</span>
        <input id="f-cook" type="number" min="0" max="1440" value="${draft.cookMinutes}" />
      </label>
      <label class="field"><span>Raciones (1–20)</span>
        <input id="f-servings" type="number" min="1" max="20" value="${draft.servings}" />
      </label>
    </div>
    <label class="field">
      <span>Descripción de la imagen (prompt)</span>
      <input id="f-image" type="text" maxlength="160" value="${escapeAttr(draft.imagePrompt)}" placeholder="p. ej. Tortilla española con patatas" />
    </label>
  `;
}

function ingredientsStep() {
  return `
    <p class="small">Añade los ingredientes con cantidad y unidad.</p>
    <div id="ingredients-list">
      ${draft.ingredients
        .map(
          (ing, idx) => `
        <div class="row ingredient-row" data-idx="${idx}">
          <label class="field"><span>Nombre</span>
            <input data-ing="name" type="text" value="${escapeAttr(ing.name)}" />
          </label>
          <label class="field"><span>Cantidad</span>
            <input data-ing="quantity" type="number" min="0.01" step="0.01" value="${ing.quantity}" />
          </label>
          <label class="field"><span>Unidad</span>
            <select data-ing="unit">
              ${UNITS.map((u) => `<option value="${u}" ${ing.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </label>
          <button type="button" class="ghost" data-remove-ingredient>Quitar</button>
        </div>
      `
        )
        .join('')}
    </div>
    <button type="button" class="ghost" id="btn-add-ingredient">Añadir ingrediente</button>
  `;
}

function stepsStep() {
  return `
    <p class="small">Describe los pasos en orden. Cada paso no debe superar 300 caracteres.</p>
    <div id="steps-list">
      ${draft.steps
        .map(
          (s, idx) => `
        <div class="row step-row" data-idx="${idx}">
          <span class="ord">${idx + 1}</span>
          <textarea data-step maxlength="300">${escapeHtml(s)}</textarea>
          <button type="button" class="ghost" data-remove-step>Quitar</button>
        </div>
      `
        )
        .join('')}
    </div>
    <button type="button" class="ghost" id="btn-add-step">Añadir paso</button>
  `;
}

function tagsStep() {
  const allergenList = window.allergenCatalog || [];
  const dietList = window.dietCatalog || [];
  return `
    <fieldset class="filters-group">
      <legend>Dietas</legend>
      <div class="chips">${dietList
        .map(
          (d) => `
          <label class="chip ${draft.diets.includes(d.id) ? 'on' : ''}">
            <input type="checkbox" data-tag="diets" value="${d.id}" ${draft.diets.includes(d.id) ? 'checked' : ''} />
            ${d.name}
          </label>`
        )
        .join('')}</div>
    </fieldset>
    <fieldset class="filters-group">
      <legend>Alérgenos presentes</legend>
      <div class="chips">${allergenList
        .map(
          (a) => `
          <label class="chip ${draft.allergens.includes(a.id) ? 'on' : ''}">
            <input type="checkbox" data-tag="allergens" value="${a.id}" ${draft.allergens.includes(a.id) ? 'checked' : ''} />
            ${a.name}
          </label>`
        )
        .join('')}</div>
    </fieldset>
  `;
}

function previewStep() {
  const dietNames = draft.diets.map((id) => (window.dietCatalog || []).find((d) => d.id === id)?.name || id);
  const allergenNames = draft.allergens.map((id) => (window.allergenCatalog || []).find((a) => a.id === id)?.name || id);
  return `
    <h3>${escapeHtml(draft.title || 'Sin título')}</h3>
    <p class="meta">${(CATEGORIES.find((c) => c.id === draft.category) || {}).label || draft.category} ·
      ${(DIFFICULTIES.find((d) => d.id === draft.difficulty) || {}).label || draft.difficulty} ·
      ${Number(draft.prepMinutes) + Number(draft.cookMinutes)} min · ${draft.servings} rac.</p>
    <p>${escapeHtml(draft.description || '')}</p>
    <div class="tags">
      ${dietNames.map((n) => `<span class="tag diet">${n}</span>`).join('')}
      ${allergenNames.map((n) => `<span class="tag warn">${n}</span>`).join('')}
    </div>
    <h4>Ingredientes (${draft.ingredients.length})</h4>
    <ul class="list">
      ${draft.ingredients
        .map((i) => `<li><span>${escapeHtml(i.name)}</span><span class="meta">${i.quantity} ${i.unit}</span></li>`)
        .join('')}
    </ul>
    <h4>Pasos (${draft.steps.length})</h4>
    <ol class="steps-list">
      ${draft.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
    </ol>
  `;
}

function bindStepEvents(view) {
  if (stepIndex === 0) {
    view.querySelector('#f-title').addEventListener('input', (e) => (draft.title = e.target.value));
    view.querySelector('#f-description').addEventListener('input', (e) => (draft.description = e.target.value));
    view.querySelector('#f-category').addEventListener('change', (e) => (draft.category = e.target.value));
    view.querySelector('#f-difficulty').addEventListener('change', (e) => (draft.difficulty = e.target.value));
    view.querySelector('#f-prep').addEventListener('input', (e) => (draft.prepMinutes = Number(e.target.value) || 0));
    view.querySelector('#f-cook').addEventListener('input', (e) => (draft.cookMinutes = Number(e.target.value) || 0));
    view.querySelector('#f-servings').addEventListener('input', (e) => (draft.servings = Number(e.target.value) || 1));
    view.querySelector('#f-image').addEventListener('input', (e) => (draft.imagePrompt = e.target.value));
  }

  if (stepIndex === 1) {
    view.querySelectorAll('.ingredient-row').forEach((row) => {
      const idx = Number(row.dataset.idx);
      row.querySelector('[data-ing="name"]').addEventListener('input', (e) => (draft.ingredients[idx].name = e.target.value));
      row.querySelector('[data-ing="quantity"]').addEventListener('input', (e) => (draft.ingredients[idx].quantity = Number(e.target.value) || 0));
      row.querySelector('[data-ing="unit"]').addEventListener('change', (e) => (draft.ingredients[idx].unit = e.target.value));
      row.querySelector('[data-remove-ingredient]').addEventListener('click', () => {
        draft.ingredients.splice(idx, 1);
        if (!draft.ingredients.length) draft.ingredients.push({ name: '', quantity: 100, unit: 'g' });
        paintWizard(view);
      });
    });
    view.querySelector('#btn-add-ingredient').addEventListener('click', () => {
      draft.ingredients.push({ name: '', quantity: 100, unit: 'g' });
      paintWizard(view);
    });
  }

  if (stepIndex === 2) {
    view.querySelectorAll('.step-row').forEach((row) => {
      const idx = Number(row.dataset.idx);
      row.querySelector('[data-step]').addEventListener('input', (e) => (draft.steps[idx] = e.target.value));
      row.querySelector('[data-remove-step]').addEventListener('click', () => {
        draft.steps.splice(idx, 1);
        if (!draft.steps.length) draft.steps.push('');
        paintWizard(view);
      });
    });
    view.querySelector('#btn-add-step').addEventListener('click', () => {
      draft.steps.push('');
      paintWizard(view);
    });
  }

  if (stepIndex === 3) {
    view.querySelectorAll('input[data-tag]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const group = cb.dataset.tag;
        const value = cb.value;
        const set = new Set(draft[group]);
        if (cb.checked) set.add(value);
        else set.delete(value);
        draft[group] = Array.from(set);
        cb.parentElement.classList.toggle('on', cb.checked);
      });
    });
  }
}

function validateStep(step) {
  const err = view_error();
  if (step === 0) {
    if (!draft.title || draft.title.trim().length < 5) {
      err.textContent = 'El título debe tener al menos 5 caracteres.';
      err.hidden = false;
      return false;
    }
    if (draft.title.trim().length > 80) {
      err.textContent = 'El título no puede superar los 80 caracteres.';
      err.hidden = false;
      return false;
    }
  }
  if (step === 1) {
    const valid = draft.ingredients.every((i) => i.name && i.name.trim() && Number(i.quantity) > 0 && i.unit);
    if (!valid) {
      err.textContent = 'Cada ingrediente necesita nombre, cantidad positiva y unidad.';
      err.hidden = false;
      return false;
    }
  }
  if (step === 2) {
    const valid = draft.steps.every((s) => s && s.trim().length > 0);
    if (!valid) {
      err.textContent = 'Cada paso necesita un texto.';
      err.hidden = false;
      return false;
    }
  }
  err.hidden = true;
  err.textContent = '';
  return true;
}

function view_error() {
  let el = document.getElementById('step-error');
  if (!el) {
    el = document.createElement('p');
    el.id = 'step-error';
    el.className = 'alert';
    el.hidden = true;
    document.querySelector('.create')?.appendChild(el);
  }
  return el;
}

async function publishRecipe(view) {
  if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return;
  const session = getSession();
  const payload = {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category,
    prepMinutes: Number(draft.prepMinutes),
    cookMinutes: Number(draft.cookMinutes),
    servings: Number(draft.servings),
    difficulty: draft.difficulty,
    diets: draft.diets,
    allergens: draft.allergens,
    ingredients: draft.ingredients.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity), unit: i.unit })),
    steps: draft.steps.map((s) => s.trim()),
    imagePrompt: (draft.imagePrompt || draft.title).trim(),
  };

  const err = view_error();
  err.hidden = true;
  try {
    const data = await api('/recipes', { method: 'POST', body: payload, auth: !!session.tokens });
    clearDraft();
    draft = null;
    const id = data.recipe?.id;
    window.location.hash = id ? `#/recipes/${id}` : '#/';
  } catch (e) {
    err.textContent = e.message || 'No hemos podido publicar la receta.';
    err.hidden = false;
  }
}

function escapeHtml(text) {
  return String(text || '').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
