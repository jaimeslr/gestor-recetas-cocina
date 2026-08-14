import { nanoid } from 'nanoid';
import type {
  Allergen,
  Category,
  Collection,
  Comment,
  Diet,
  Difficulty,
  Follow,
  Ingredient,
  Plan,
  PlanEntry,
  Rating,
  Recipe,
  RecipeStatus,
  Report,
  Save,
  Session,
  Step,
  User,
  UserRole,
  Verification,
} from './types/domain.js';

const now = (): string => new Date().toISOString();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  publicName: string;
  bio?: string;
  country?: string | null;
  avatarColor?: string;
  role?: UserRole;
  verifiedAt?: string | null;
};

export type CreateRecipeInput = {
  authorId: string;
  title: string;
  description?: string;
  imagePrompt?: string;
  category: Category;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: Difficulty;
  diets?: string[];
  allergens?: string[];
  ingredients: Ingredient[];
  steps: Step[];
  status?: RecipeStatus;
  publishedAt?: string;
};

export type CreateSessionInput = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type AddCommentInput = {
  recipeId: string;
  authorId: string;
  text: string;
  parentId?: string | null;
};

export type SetRatingInput = {
  userId: string;
  recipeId: string;
  stars: number;
};

export type GetRatingInput = {
  userId: string;
  recipeId: string;
};

export type CreateCollectionInput = {
  userId: string;
  name: string;
};

export type SaveRecipeInput = {
  userId: string;
  recipeId: string;
  collectionId: string;
};

export type SaveKeyInput = {
  userId: string;
  recipeId: string;
  collectionId: string;
};

export type FollowInput = {
  followerId: string;
  followedId: string;
};

export type AddEntryInput = {
  day: PlanEntry['day'];
  meal: PlanEntry['meal'];
  recipeId: string;
  servings: number;
};

export type AddReportInput = {
  status?: string;
  [key: string]: unknown;
};

export class MemoryStore {
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, Session>();
  private readonly verifications = new Map<string, Verification>();
  private readonly recipes = new Map<string, Recipe>();
  private readonly comments = new Map<string, Comment>();
  private readonly ratings = new Map<string, Rating>();
  private readonly collections = new Map<string, Collection>();
  private readonly saves = new Map<string, Save>();
  private readonly follows = new Map<string, Follow>();
  private readonly plans = new Map<string, Plan>();
  private readonly reports = new Map<string, Report>();
  private readonly allergens: Allergen[] = [];
  private readonly diets: Diet[] = [];

  // --- Usuarios ---
  createUser(input: CreateUserInput): User {
    const id = nanoid(12);
    const record: User = {
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      publicName: input.publicName,
      bio: input.bio ?? '',
      country: input.country ?? null,
      avatarColor: input.avatarColor ?? '#f97316',
      role: input.role ?? 'user',
      verifiedAt: input.verifiedAt ?? now(),
      createdAt: now(),
    };
    this.users.set(id, record);
    return record;
  }

  findUserByEmail(email: string): User | null {
    const target = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === target) return user;
    }
    return null;
  }

  getUser(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  updateUser(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): User | null {
    const current = this.users.get(id);
    if (!current) return null;
    const next: User = { ...current, ...patch };
    this.users.set(id, next);
    return next;
  }

  listUsers(): User[] {
    return Array.from(this.users.values());
  }

  // --- Sesiones / tokens ---
  createSession(input: CreateSessionInput): Session {
    const session: Session = {
      id: nanoid(10),
      userId: input.userId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
    };
    this.sessions.set(input.accessToken, session);
    this.sessions.set(input.refreshToken, session);
    return session;
  }

  findSessionByToken(token: string): Session | null {
    return this.sessions.get(token) ?? null;
  }

  removeSessionByToken(token: string): Session | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    this.sessions.delete(session.accessToken);
    this.sessions.delete(session.refreshToken);
    return session;
  }

  // --- Verificación de email ---
  saveVerification(input: { userId: string; code: string; expiresAt: string }): void {
    this.verifications.set(input.userId, { code: input.code, expiresAt: input.expiresAt });
  }

  consumeVerification(userId: string, code: string): boolean {
    const record = this.verifications.get(userId);
    if (!record) return false;
    if (record.code !== code) return false;
    if (new Date(record.expiresAt).getTime() < Date.now()) return false;
    this.verifications.delete(userId);
    return true;
  }

  // --- Recetas ---
  createRecipe(input: CreateRecipeInput): Recipe {
    const id = nanoid(14);
    const record: Recipe = {
      id,
      authorId: input.authorId,
      title: input.title,
      description: input.description ?? '',
      imagePrompt: input.imagePrompt ?? input.title,
      category: input.category,
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
      servings: input.servings,
      difficulty: input.difficulty,
      diets: input.diets ?? [],
      allergens: input.allergens ?? [],
      ingredients: input.ingredients,
      steps: input.steps,
      status: input.status ?? 'publicada',
      publishedAt: input.publishedAt ?? now(),
      ratingSum: 0,
      ratingCount: 0,
      saveCount: 0,
    };
    this.recipes.set(id, record);
    return record;
  }

  getRecipe(id: string): Recipe | null {
    return this.recipes.get(id) ?? null;
  }

  updateRecipe(id: string, patch: Partial<Recipe>): Recipe | null {
    const current = this.recipes.get(id);
    if (!current) return null;
    const next: Recipe = { ...current, ...patch };
    this.recipes.set(id, next);
    return next;
  }

  listRecipes(): Recipe[] {
    return Array.from(this.recipes.values());
  }

  hideRecipe(id: string): Recipe | null {
    return this.updateRecipe(id, { status: 'oculta' });
  }

  // --- Comentarios ---
  addComment(input: AddCommentInput): Comment {
    const id = nanoid(12);
    const record: Comment = {
      id,
      recipeId: input.recipeId,
      authorId: input.authorId,
      text: input.text,
      parentId: input.parentId ?? null,
      createdAt: now(),
    };
    this.comments.set(id, record);
    return record;
  }

  listComments(recipeId: string): Comment[] {
    return Array.from(this.comments.values())
      .filter((c) => c.recipeId === recipeId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  countComments(recipeId: string): number {
    return this.listComments(recipeId).length;
  }

  // --- Valoraciones ---
  setRating(input: SetRatingInput): Rating {
    const key = `${input.userId}:${input.recipeId}`;
    const previous = this.ratings.get(key);
    const record: Rating = {
      userId: input.userId,
      recipeId: input.recipeId,
      stars: input.stars,
      createdAt: previous?.createdAt ?? now(),
    };
    this.ratings.set(key, record);
    this.recalculateRating(input.recipeId);
    return record;
  }

  getRating(input: GetRatingInput): Rating | null {
    return this.ratings.get(`${input.userId}:${input.recipeId}`) ?? null;
  }

  recalculateRating(recipeId: string): void {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return;
    let sum = 0;
    let count = 0;
    for (const rating of this.ratings.values()) {
      if (rating.recipeId === recipeId) {
        sum += rating.stars;
        count += 1;
      }
    }
    recipe.ratingSum = sum;
    recipe.ratingCount = count;
  }

  // --- Colecciones ---
  createCollection(input: CreateCollectionInput): Collection {
    const id = nanoid(10);
    const record: Collection = {
      id,
      userId: input.userId,
      name: input.name,
      createdAt: now(),
    };
    this.collections.set(id, record);
    return record;
  }

  listCollections(userId: string): Collection[] {
    return Array.from(this.collections.values()).filter((c) => c.userId === userId);
  }

  getCollection(id: string): Collection | null {
    return this.collections.get(id) ?? null;
  }

  updateCollection(id: string, patch: Partial<Collection>): Collection | null {
    const current = this.collections.get(id);
    if (!current) return null;
    const next: Collection = { ...current, ...patch };
    this.collections.set(id, next);
    return next;
  }

  deleteCollection(id: string): void {
    this.collections.delete(id);
    this.saves.forEach((save, key) => {
      if (save.collectionId === id) this.saves.delete(key);
    });
  }

  // --- Guardados ---
  saveRecipe(input: SaveRecipeInput): Save {
    const key = `${input.userId}:${input.recipeId}:${input.collectionId}`;
    const existing = this.saves.get(key);
    if (existing) return existing;
    const record: Save = {
      id: nanoid(10),
      userId: input.userId,
      recipeId: input.recipeId,
      collectionId: input.collectionId,
      createdAt: now(),
    };
    this.saves.set(key, record);
    this.recalculateSaveCount(input.recipeId);
    return record;
  }

  unsaveRecipe(input: SaveKeyInput): boolean {
    const key = `${input.userId}:${input.recipeId}:${input.collectionId}`;
    const existing = this.saves.get(key);
    if (!existing) return false;
    this.saves.delete(key);
    this.recalculateSaveCount(input.recipeId);
    return true;
  }

  listSavesForUser(userId: string): Save[] {
    return Array.from(this.saves.values()).filter((s) => s.userId === userId);
  }

  listSavesForRecipe(recipeId: string): Save[] {
    return Array.from(this.saves.values()).filter((s) => s.recipeId === recipeId);
  }

  recalculateSaveCount(recipeId: string): void {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return;
    recipe.saveCount = 0;
    for (const save of this.saves.values()) {
      if (save.recipeId === recipeId) recipe.saveCount += 1;
    }
  }

  // --- Seguimientos ---
  follow(input: FollowInput): Follow {
    const key = `${input.followerId}:${input.followedId}`;
    const existing = this.follows.get(key);
    if (existing) return existing;
    const record: Follow = {
      id: nanoid(10),
      followerId: input.followerId,
      followedId: input.followedId,
      createdAt: now(),
    };
    this.follows.set(key, record);
    return record;
  }

  unfollow(input: FollowInput): boolean {
    const key = `${input.followerId}:${input.followedId}`;
    if (!this.follows.has(key)) return false;
    this.follows.delete(key);
    return true;
  }

  isFollowing(input: FollowInput): boolean {
    return this.follows.has(`${input.followerId}:${input.followedId}`);
  }

  listFollowers(userId: string): Follow[] {
    return Array.from(this.follows.values()).filter((f) => f.followedId === userId);
  }

  listFollowing(userId: string): Follow[] {
    return Array.from(this.follows.values()).filter((f) => f.followerId === userId);
  }

  // --- Plan semanal ---
  getOrCreatePlan(userId: string, monday: string): Plan {
    const key = `${userId}:${monday}`;
    let plan = this.plans.get(key);
    if (!plan) {
      plan = { id: key, userId, monday, entries: [] };
      this.plans.set(key, plan);
    }
    return plan;
  }

  addEntry(planId: string, entry: AddEntryInput): PlanEntry | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    const record: PlanEntry = { id: nanoid(10), ...entry };
    plan.entries.push(record);
    return record;
  }

  updateEntry(planId: string, entryId: string, patch: Partial<PlanEntry>): PlanEntry | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    const idx = plan.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return null;
    plan.entries[idx] = { ...plan.entries[idx], ...patch };
    return plan.entries[idx];
  }

  removeEntry(planId: string, entryId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    const before = plan.entries.length;
    plan.entries = plan.entries.filter((e) => e.id !== entryId);
    return plan.entries.length < before;
  }

  // --- Vocabularios ---
  setAllergens(list: Allergen[]): void {
    this.allergens.length = 0;
    this.allergens.push(...list);
  }

  setDiets(list: Diet[]): void {
    this.diets.length = 0;
    this.diets.push(...list);
  }

  // --- Reportes ---
  addReport(input: AddReportInput): Report {
    const id = nanoid(10);
    const record = {
      id,
      status: 'pendiente',
      createdAt: now(),
      ...input,
    } as Report;
    this.reports.set(id, record);
    return record;
  }

  listReports(status?: string): Report[] {
    return Array.from(this.reports.values()).filter((r) => !status || r.status === status);
  }
}

export const store = new MemoryStore();
export { clone };