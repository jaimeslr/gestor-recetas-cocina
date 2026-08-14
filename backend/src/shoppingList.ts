import { NORMALIZABLE_UNITS, UNITS } from './vocabularies.js';
import type { Plan, Recipe } from './types/domain.js';
import type { ShoppingItem } from './types/api.js';

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function getBaseUnit(unit: string): string | null {
  return NORMALIZABLE_UNITS[unit]?.base ?? null;
}

export function consolidateShoppingList(plan: Plan, recipes: Map<string, Recipe>): ShoppingItem[] {
  const grouped = new Map<
    string,
    {
      name: string;
      base: string;
      entries: Array<{ quantity: number; unit: string }>;
    }
  >();

  for (const entry of plan.entries) {
    const recipe = recipes.get(entry.recipeId);
    if (!recipe) continue;
    const ratio = entry.servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      const key = normalizeKey(ing.name);
      const base = getBaseUnit(ing.unit);
      const quantity = ing.quantity * ratio;
      if (!grouped.has(key)) {
        grouped.set(key, { name: ing.name, base: 'texto', entries: [] });
      }
      const bucket = grouped.get(key)!;
      if (base) {
        if (bucket.base === 'texto') bucket.entries = [];
        bucket.base = base;
      }
      bucket.entries.push({ quantity, unit: ing.unit });
    }
  }

  const items: ShoppingItem[] = [];
  for (const bucket of grouped.values()) {
    if (bucket.base === 'texto') {
      const textBuckets = new Map<string, { quantity: number; unit: string }>();
      for (const e of bucket.entries) {
        const prev = textBuckets.get(e.unit) ?? { quantity: 0, unit: e.unit };
        prev.quantity += e.quantity;
        textBuckets.set(e.unit, prev);
      }
      for (const value of textBuckets.values()) {
        items.push({
          name: bucket.name,
          quantity: Math.round(value.quantity * 100) / 100,
          unit: value.unit,
          label: `${value.quantity} ${value.unit}`,
        });
      }
    } else {
      let total = 0;
      for (const e of bucket.entries) {
        const norm = NORMALIZABLE_UNITS[e.unit];
        if (!norm) continue;
        total += (e.quantity * (norm.factor ?? 1)) / (NORMALIZABLE_UNITS[bucket.base]?.factor ?? 1);
      }
      items.push({
        name: bucket.name,
        quantity: Math.round(total * 100) / 100,
        unit: bucket.base,
        label: `${total.toFixed(2).replace(/\.00$/, '')} ${bucket.base}`,
      });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return items;
}

export function listUnits(): string[] {
  return UNITS;
}
