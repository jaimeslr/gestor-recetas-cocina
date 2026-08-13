import {
  ALLERGENS,
  DIETS,
  CATEGORIES,
  DIFFICULTIES,
  UNITS,
  MEAL_SLOTS,
  DAYS,
} from './vocabularies.js';

function asTrimmedString(value, { min = 1, max, allowEmpty = false } = {}) {
  if (value == null) return allowEmpty ? '' : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length < min) return null;
  if (max && trimmed.length > max) return null;
  return trimmed;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateRegistration(input) {
  const errors = [];
  const email = asTrimmedString(input.email, { min: 5, max: 120 });
  const publicName = asTrimmedString(input.publicName, { min: 2, max: 40 });
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email_invalido');
  if (!publicName) errors.push('nombre_publico_invalido');
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) errors.push('password_debil');

  return { errors, data: { email, publicName, password } };
}

export function validateRecipePayload(input, { isUpdate = false } = {}) {
  const errors = [];
  const data = {};

  const title = asTrimmedString(input.title, { min: 5, max: 80 });
  if (!title) errors.push('titulo_invalido');
  data.title = title;

  const description = asTrimmedString(input.description, { min: 0, max: 500, allowEmpty: true });
  if (description == null) errors.push('descripcion_invalida');
  data.description = description || '';

  if (!CATEGORIES.includes(input.category)) errors.push('categoria_invalida');
  data.category = input.category;

  if (!isFiniteNumber(input.prepMinutes) || input.prepMinutes < 0 || input.prepMinutes > 1440)
    errors.push('tiempo_prep_invalido');
  data.prepMinutes = Number(input.prepMinutes) || 0;

  if (!isFiniteNumber(input.cookMinutes) || input.cookMinutes < 0 || input.cookMinutes > 1440)
    errors.push('tiempo_coccion_invalido');
  data.cookMinutes = Number(input.cookMinutes) || 0;

  const servings = Number(input.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) errors.push('raciones_invalidas');
  data.servings = servings;

  if (!DIFFICULTIES.includes(input.difficulty)) errors.push('dificultad_invalida');
  data.difficulty = input.difficulty;

  data.diets = Array.isArray(input.diets) ? input.diets.filter((d) => DIETS.some((x) => x.id === d)) : [];
  const unknownDiets = (input.diets || []).filter((d) => !DIETS.some((x) => x.id === d));
  if (unknownDiets.length) errors.push('dietas_desconocidas');

  data.allergens = Array.isArray(input.allergens)
    ? input.allergens.filter((a) => ALLERGENS.some((x) => x.id === a))
    : [];
  const unknownAllergens = (input.allergens || []).filter((a) => !ALLERGENS.some((x) => x.id === a));
  if (unknownAllergens.length) errors.push('alergenos_desconocidos');

  if (!Array.isArray(input.ingredients) || input.ingredients.length < 1) {
    errors.push('ingredientes_requeridos');
    data.ingredients = [];
  } else {
    data.ingredients = input.ingredients.map((ing, idx) => {
      const name = asTrimmedString(ing?.name, { min: 1, max: 60 });
      const quantity = Number(ing?.quantity);
      const unit = UNITS.includes(ing?.unit) ? ing.unit : null;
      if (!name) errors.push(`ingrediente_${idx}_sin_nombre`);
      if (!isFiniteNumber(quantity) || quantity <= 0) errors.push(`ingrediente_${idx}_cantidad_invalida`);
      if (!unit) errors.push(`ingrediente_${idx}_unidad_invalida`);
      return { name, quantity, unit };
    });
  }

  if (!Array.isArray(input.steps) || input.steps.length < 1) {
    errors.push('pasos_requeridos');
    data.steps = [];
  } else {
    data.steps = input.steps.map((step, idx) => {
      const text = asTrimmedString(typeof step === 'string' ? step : step?.text, { min: 1, max: 300 });
      if (!text) errors.push(`paso_${idx}_vacio`);
      return { order: idx + 1, text };
    });
  }

  if (!isUpdate && !input.imagePrompt) errors.push('imagen_requerida');
  data.imagePrompt = asTrimmedString(input.imagePrompt, { min: 1, max: 160 }) || title;

  return { errors, data };
}

export function validateCommentPayload(input) {
  const text = asTrimmedString(input?.text, { min: 1, max: 500 });
  return { valid: !!text, text };
}

export function validateRatingPayload(input) {
  const stars = Number(input?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { valid: false };
  return { valid: true, stars };
}

export function validatePlanEntryPayload(input) {
  const errors = [];
  const monday = asTrimmedString(input.monday, { min: 10, max: 10 });
  if (!monday || !/^\d{4}-\d{2}-\d{2}$/.test(monday)) errors.push('lunes_invalido');
  if (!DAYS.includes(input.day)) errors.push('dia_invalido');
  if (!MEAL_SLOTS.includes(input.meal)) errors.push('comida_invalida');
  if (!input.recipeId) errors.push('receta_requerida');
  const servings = Number(input.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) errors.push('raciones_invalidas');
  return {
    errors,
    data: { monday, day: input.day, meal: input.meal, recipeId: input.recipeId, servings },
  };
}

export function validateSearchFilters(input) {
  const filters = {};
  if (input.q) filters.q = String(input.q).trim().toLowerCase();
  if (input.allergens) {
    const list = Array.isArray(input.allergens) ? input.allergens : String(input.allergens).split(',');
    filters.allergens = list.map((s) => s.trim()).filter(Boolean);
  }
  if (input.diets) {
    const list = Array.isArray(input.diets) ? input.diets : String(input.diets).split(',');
    filters.diets = list.map((s) => s.trim()).filter(Boolean);
  }
  if (input.maxTime) {
    const n = Number(input.maxTime);
    if (Number.isFinite(n)) filters.maxTime = n;
  }
  if (input.difficulty) filters.difficulty = input.difficulty;
  if (input.category) filters.category = input.category;
  if (input.sort) filters.sort = String(input.sort);
  return filters;
}
