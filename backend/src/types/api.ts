import type { Day, Recipe, User } from './domain.js';

export interface PublicUser {
  id: string;
  publicName: string;
  bio?: string;
  country?: string | null;
  avatarColor?: string;
  role: User['role'];
  verified: boolean;
  followers: number;
  following: number;
  isSelf: boolean;
  isFollowing: boolean;
}

export interface RecipeSummary {
  id: string;
  title: string;
  description: string;
  imagePrompt?: string;
  imageUrl: string;
  category: Recipe['category'];
  difficulty: Recipe['difficulty'];
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  servings: number;
  diets: string[];
  allergens: string[];
  ratingAvg: number;
  ratingCount: number;
  saveCount: number;
  author: {
    id: string;
    publicName: string;
    avatarColor?: string;
  } | null;
  publishedAt: string;
}

export interface RecipeFull extends RecipeSummary {
  steps: Recipe['steps'];
  ingredients: Recipe['ingredients'];
  userRating: number | null;
  savedIn: Array<{ id: string; name: string }>;
  commentCount: number;
  status: Recipe['status'];
  author: {
    id: string;
    publicName: string;
    avatarColor?: string;
    isFollowing: boolean;
  } | null;
}

export interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  label: string;
}

export interface ShoppingListResponse {
  monday: string;
  items: ShoppingItem[];
}

export interface HydratedPlanEntry {
  entryId: string;
  day: Day;
  meal: string;
  servings: number;
  recipe: {
    id: string;
    title: string;
    imageUrl: string;
    totalMinutes: number;
  };
}

export interface HydratedPlan {
  id: string;
  monday: string;
  entries: HydratedPlanEntry[];
}

export interface CommentWithAuthor {
  id: string;
  recipeId: string;
  authorId: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  author: {
    id: string;
    publicName: string;
    avatarColor?: string;
  } | null;
  replies: CommentWithAuthor[];
}

export interface SavedItem {
  save: { id: string; userId: string; recipeId: string; collectionId: string; createdAt: string };
  recipe: RecipeFull | null;
  collection: { id: string; userId: string; name: string; createdAt: string } | null;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  traceId?: string;
}