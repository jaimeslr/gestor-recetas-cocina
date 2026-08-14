// Vocabularios cerrados: alérgenos (UE 1169/2011) y dietas canónicas.
// Cualquier valor entrante se valida contra esta lista; valores fuera se rechazan
// con 422 UnknownAllergen / UnknownDiet para preservar la invariante CA-03.
import type {
  Allergen,
  Category,
  Day,
  Diet,
  Difficulty,
  MealSlot,
  NormalizableUnit,
  Unit,
} from './types/domain.js';

export const ALLERGENS: Allergen[] = [
  { id: 'gluten', name: 'Gluten' },
  { id: 'crustaceos', name: 'Crustáceos' },
  { id: 'huevos', name: 'Huevos' },
  { id: 'pescado', name: 'Pescado' },
  { id: 'cacahuetes', name: 'Cacahuetes' },
  { id: 'soja', name: 'Soja' },
  { id: 'leche', name: 'Leche' },
  { id: 'frutos_cascara', name: 'Frutos de cáscara' },
  { id: 'apio', name: 'Apio' },
  { id: 'mostaza', name: 'Mostaza' },
  { id: 'sesamo', name: 'Sésamo' },
  { id: 'sulfitos', name: 'Sulfitos' },
  { id: 'moluscos', name: 'Moluscos' },
  { id: 'altramuces', name: 'Altramuces' },
];

export const DIETS: Diet[] = [
  { id: 'vegetariana', name: 'Vegetariana' },
  { id: 'vegana', name: 'Vegana' },
  { id: 'sin_gluten', name: 'Sin gluten' },
  { id: 'sin_lactosa', name: 'Sin lactosa' },
  { id: 'baja_carbohidratos', name: 'Baja en carbohidratos' },
  { id: 'keto', name: 'Keto' },
  { id: 'mediterranea', name: 'Mediterránea' },
  { id: 'pescetariana', name: 'Pescetariana' },
  { id: 'halal', name: 'Halal' },
  { id: 'kosher', name: 'Kosher' },
];

export const CATEGORIES: Category[] = [
  'desayuno',
  'comida',
  'cena',
  'snack',
  'postre',
  'bebida',
  'salsa',
  'guarnicion',
  'panaderia',
];

export const DIFFICULTIES: Difficulty[] = ['facil', 'media', 'dificil'];

export const MEAL_SLOTS: MealSlot[] = ['desayuno', 'comida', 'cena', 'snack'];
export const DAYS: Day[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export const UNITS: Unit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'ud',
  'cdita',
  'cdta',
  'taza',
  'pizca',
  'diente',
  'rebanada',
];

export const NORMALIZABLE_UNITS: Record<string, NormalizableUnit> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ud: { base: 'ud', factor: 1 },
};

export function findAllergen(id: string): Allergen | null {
  return ALLERGENS.find((a) => a.id === id) ?? null;
}

export function findDiet(id: string): Diet | null {
  return DIETS.find((d) => d.id === id) ?? null;
}
