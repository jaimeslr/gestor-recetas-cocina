// Tipos compartidos del dominio. Centralizan contratos para que rutas,
// serializadores y validadores operen sobre las mismas formas.
import type { PublicUser } from './api.js';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  publicName: string;
  bio?: string;
  country?: string | null;
  avatarColor?: string;
  role: UserRole;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface Verification {
  code: string;
  expiresAt: string;
}

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'ud' | 'cdita' | 'cdta' | 'taza' | 'pizca' | 'diente' | 'rebanada';

export type Difficulty = 'facil' | 'media' | 'dificil';

export type Category =
  | 'desayuno'
  | 'comida'
  | 'cena'
  | 'snack'
  | 'postre'
  | 'bebida'
  | 'salsa'
  | 'guarnicion'
  | 'panaderia';

export type Day = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export type MealSlot = 'desayuno' | 'comida' | 'cena' | 'snack';

export interface Ingredient {
  name: string;
  quantity: number;
  unit: Unit;
}

export interface Step {
  order: number;
  text: string;
}

export type RecipeStatus = 'publicada' | 'oculta';

export interface Recipe {
  id: string;
  authorId: string;
  title: string;
  description: string;
  imagePrompt: string;
  category: Category;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: Difficulty;
  diets: string[];
  allergens: string[];
  ingredients: Ingredient[];
  steps: Step[];
  status: RecipeStatus;
  publishedAt: string;
  ratingSum: number;
  ratingCount: number;
  saveCount: number;
}

export interface Comment {
  id: string;
  recipeId: string;
  authorId: string;
  text: string;
  parentId: string | null;
  createdAt: string;
}

export interface Rating {
  userId: string;
  recipeId: string;
  stars: number;
  createdAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Save {
  id: string;
  userId: string;
  recipeId: string;
  collectionId: string;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followedId: string;
  createdAt: string;
}

export interface PlanEntry {
  id: string;
  day: Day;
  meal: MealSlot;
  recipeId: string;
  servings: number;
}

export interface Plan {
  id: string;
  userId: string;
  monday: string;
  entries: PlanEntry[];
}

export interface Report {
  id: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface Allergen {
  id: string;
  name: string;
}

export interface Diet {
  id: string;
  name: string;
}

export interface NormalizableUnit {
  base: string;
  factor: number;
}

export type TokenPair = { access: string; refresh: string };
export type SessionResponse = { user: PublicUser; tokens: TokenPair };
export type SessionWithFavorites = SessionResponse & { favoritesCollectionId: string };