import { store } from '../db.js';
import type { Recipe } from '../types/domain.js';
import type { RecipeFull } from '../types/api.js';

export function serialiseRecipeFull(recipe: Recipe, viewerId: string | null | undefined): RecipeFull {
  const author = store.getUser(recipe.authorId);
  const isFollowing = viewerId
    ? store.isFollowing({ followerId: viewerId, followedId: recipe.authorId })
    : false;
  const userRating = viewerId
    ? store.getRating({ userId: viewerId, recipeId: recipe.id })?.stars ?? null
    : null;
  const saves = viewerId
    ? store.listSavesForUser(viewerId).filter((s) => s.recipeId === recipe.id)
    : [];
  const collections = saves
    .map((s) => store.getCollection(s.collectionId))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const comments = store.listComments(recipe.id);
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imagePrompt: recipe.imagePrompt,
    imageUrl: `/v1/recipes/${recipe.id}/image`,
    category: recipe.category,
    difficulty: recipe.difficulty,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
    servings: recipe.servings,
    diets: recipe.diets,
    allergens: recipe.allergens,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    ratingAvg: recipe.ratingCount ? recipe.ratingSum / recipe.ratingCount : 0,
    ratingCount: recipe.ratingCount,
    saveCount: recipe.saveCount,
    commentCount: comments.length,
    author: author
      ? {
          id: author.id,
          publicName: author.publicName,
          avatarColor: author.avatarColor,
          isFollowing,
        }
      : null,
    userRating,
    savedIn: collections.map((c) => ({ id: c.id, name: c.name })),
    publishedAt: recipe.publishedAt,
    status: recipe.status,
  };
}
