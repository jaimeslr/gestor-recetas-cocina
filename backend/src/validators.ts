import {
  ALLERGENS,
  CATEGORIES,
  DAYS,
  DIETS,
  DIFFICULTIES,
  MEAL_SLOTS,
  UNITS,
} from './vocabularies.js';

interface ValidationResult<T> {
  errors: string[];
  data: T;
}

interface RegistrationData {
  email: string;
  publicName: string;
  password: string;
}

interface IngredientInput {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
}

interface RecipePayloadData {
  title: string;
  description: string;
  category: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: string;
  diets: string[];
  allergens: string[];
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  steps: Array<{ order: number; text: string }>;
  imagePrompt: string;
}

interface PlanEntryData {
  monday: string;
  day: string;
  meal: string;
  recipeId: string;
  servings: number;
}

export interface SearchFilters {
  q?: string;
  allergens?: string[];
  diets?: string[];
  maxTime?: number;
  difficulty?: string;
  category?: string;
  sort?: string;
}

function asTrimmedString(
  value: unknown,
  { min = 1, max, allowEmpty = false }: { min?: number; max?: number; allowEmpty?: boolean } = {},
): string | null {
  if (value == null) return allowEmpty ? '' : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length < min) return null;
  if (max && trimmed.length > max) return null;
  return trimmed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateRegistration(input: Record<string, unknown> | undefined): ValidationResult<RegistrationData> {
  const body = input ?? {};
  const errors: string[] = [];
  const email = asTrimmedString(body.email, { min: 5, max: 120 });
  const publicName = asTrimmedString(body.publicName, { min: 2, max: 40 });
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email_invalido');
  if (!publicName) errors.push('nombre_publico_invalido');
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) errors.push('password_debil');

  return {
    errors,
    data: { email: email ?? '', publicName: publicName ?? '', password },
  };
}

export function validateRecipePayload(
  input: Record<string, unknown> | undefined,
  { isUpdate = false }: { isUpdate?: boolean } = {},
): ValidationResult<RecipePayloadData> {
  const body = input ?? {};
  const errors: string[] = [];
  const data: RecipePayloadData = {
    title: '',
    description: '',
    category: '',
    prepMinutes: 0,
    cookMinutes: 0,
    servings: 0,
    difficulty: '',
    diets: [],
    allergens: [],
    ingredients: [],
    steps: [],
    imagePrompt: '',
  };

  const title = asTrimmedString(body.title, { min: 5, max: 80 });
  if (!title) errors.push('titulo_invalido');
  data.title = title ?? '';

  const description = asTrimmedString(body.description, { min: 0, max: 500, allowEmpty: true });
  if (description == null) errors.push('descripcion_invalida');
  data.description = description ?? '';

  const category = typeof body.category === 'string' ? body.category : '';
  if (!CATEGORIES.includes(category as never)) errors.push('categoria_invalida');
  data.category = category;

  const prepMinutes = Number(body.prepMinutes);
  if (!isFiniteNumber(prepMinutes) || prepMinutes < 0 || prepMinutes > 1440) {
    errors.push('tiempo_prep_invalido');
  }
  data.prepMinutes = isFiniteNumber(prepMinutes) ? prepMinutes : 0;

  const cookMinutes = Number(body.cookMinutes);
  if (!isFiniteNumber(cookMinutes) || cookMinutes < 0 || cookMinutes > 1440) {
    errors.push('tiempo_coccion_invalido');
  }
  data.cookMinutes = isFiniteNumber(cookMinutes) ? cookMinutes : 0;

  const servings = Number(body.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) errors.push('raciones_invalidas');
  data.servings = servings;

  const difficulty = typeof body.difficulty === 'string' ? body.difficulty : '';
  if (!DIFFICULTIES.includes(difficulty as never)) errors.push('dificultad_invalida');
  data.difficulty = difficulty;

  const inputDiets = Array.isArray(body.diets) ? body.diets : [];
  data.diets = inputDiets.filter((d): d is string => typeof d === 'string' && DIETS.some((x) => x.id === d));
  if (inputDiets.some((d) => typeof d !== 'string' || !DIETS.some((x) => x.id === d))) {
    errors.push('dietas_desconocidas');
  }

  const inputAllergens = Array.isArray(body.allergens) ? body.allergens : [];
  data.allergens = inputAllergens.filter(
    (a): a is string => typeof a === 'string' && ALLERGENS.some((x) => x.id === a),
  );
  if (inputAllergens.some((a) => typeof a !== 'string' || !ALLERGENS.some((x) => x.id === a))) {
    errors.push('alergenos_desconocidos');
  }

  if (!Array.isArray(body.ingredients) || body.ingredients.length < 1) {
    errors.push('ingredientes_requeridos');
  } else {
    data.ingredients = body.ingredients.map((raw: IngredientInput, idx: number) => {
      const name = asTrimmedString(raw.name, { min: 1, max: 60 });
      const quantity = Number(raw.quantity);
      const unit = typeof raw.unit === 'string' && UNITS.includes(raw.unit as never) ? raw.unit : null;
      if (!name) errors.push(`ingrediente_${idx}_sin_nombre`);
      if (!isFiniteNumber(quantity) || quantity <= 0) errors.push(`ingrediente_${idx}_cantidad_invalida`);
      if (!unit) errors.push(`ingrediente_${idx}_unidad_invalida`);
      return { name: name ?? '', quantity, unit: unit ?? '' };
    });
  }

  if (!Array.isArray(body.steps) || body.steps.length < 1) {
    errors.push('pasos_requeridos');
  } else {
    data.steps = body.steps.map((step: unknown, idx: number) => {
      const text = asTrimmedString(typeof step === 'string' ? step : (step as { text?: unknown })?.text, {
        min: 1,
        max: 300,
      });
      if (!text) errors.push(`paso_${idx}_vacio`);
      return { order: idx + 1, text: text ?? '' };
    });
  }

  if (!isUpdate && !body.imagePrompt) errors.push('imagen_requerida');
  data.imagePrompt = asTrimmedString(body.imagePrompt, { min: 1, max: 160 }) ?? data.title;

  return { errors, data };
}

export function validateCommentPayload(input: Record<string, unknown> | undefined): { valid: boolean; text: string } {
  const text = asTrimmedString(input?.text, { min: 1, max: 500 });
  return { valid: !!text, text: text ?? '' };
}

export function validateRatingPayload(input: Record<string, unknown> | undefined): { valid: boolean; stars: number } {
  const stars = Number(input?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { valid: false, stars: 0 };
  return { valid: true, stars };
}

export function validatePlanEntryPayload(
  input: Record<string, unknown> | undefined,
): ValidationResult<PlanEntryData> {
  const body = input ?? {};
  const errors: string[] = [];
  const monday = asTrimmedString(body.monday, { min: 10, max: 10 });
  if (!monday || !/^\d{4}-\d{2}-\d{2}$/.test(monday)) errors.push('lunes_invalido');
  const day = typeof body.day === 'string' ? body.day : '';
  if (!DAYS.includes(day as never)) errors.push('dia_invalido');
  const meal = typeof body.meal === 'string' ? body.meal : '';
  if (!MEAL_SLOTS.includes(meal as never)) errors.push('comida_invalida');
  const recipeId = typeof body.recipeId === 'string' && body.recipeId ? body.recipeId : '';
  if (!recipeId) errors.push('receta_requerida');
  const servings = Number(body.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) errors.push('raciones_invalidas');

  return {
    errors,
    data: { monday: monday ?? '', day, meal, recipeId, servings },
  };
}

export function validateSearchFilters(input: Record<string, string | string[] | undefined>): SearchFilters {
  const filters: SearchFilters = {};
  const read = (key: string): string | string[] | undefined => input[key];
  const q = read('q');
  if (typeof q === 'string') filters.q = q.trim().toLowerCase();
  const allergens = read('allergens');
  if (typeof allergens === 'string' || Array.isArray(allergens)) {
    const list = Array.isArray(allergens) ? allergens : allergens.split(',');
    filters.allergens = list.map((s) => String(s).trim()).filter(Boolean);
  }
  const diets = read('diets');
  if (typeof diets === 'string' || Array.isArray(diets)) {
    const list = Array.isArray(diets) ? diets : diets.split(',');
    filters.diets = list.map((s) => String(s).trim()).filter(Boolean);
  }
  const maxTime = read('maxTime');
  if (typeof maxTime === 'string') {
    const n = Number(maxTime);
    if (Number.isFinite(n)) filters.maxTime = n;
  }
  const difficulty = read('difficulty');
  if (typeof difficulty === 'string') filters.difficulty = difficulty;
  const category = read('category');
  if (typeof category === 'string') filters.category = category;
  const sort = read('sort');
  if (typeof sort === 'string') filters.sort = sort;
  return filters;
}