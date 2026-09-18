import { z } from "zod";

export const categories = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Category = (typeof categories)[number];
export const units = ["g", "kg", "ml", "l", "piece", "tsp", "tbsp"] as const;
export type Unit = (typeof units)[number];
const text = z.string().trim().min(1).max(4000);
const positive = z.number().finite().positive().max(1000000);
export const ingredientSchema = z.object({
  name: text,
  quantity: positive,
  unit: z.enum(units),
  preparation: z.string().max(2000).default(""),
});
export const recipeStepSchema = z.object({
  instruction: text,
  timerSeconds: z.number().int().positive().max(86400).nullable().default(null),
});
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export const recipeSchema = z.object({
  schemaVersion: z.literal(1),
  title: text,
  description: z.string().max(4000).default(""),
  mealCategories: z.array(z.enum(categories)).min(1),
  servings: positive,
  totalCaloriesKcal: z.number().finite().min(0).max(1000000),
  prepTimeMinutes: z.number().finite().min(0).max(10000).default(0),
  cookTimeMinutes: z.number().finite().min(0).max(10000).default(0),
  ingredients: z.array(ingredientSchema).min(1).max(150),
  steps: z
    .array(
      z.object({
        instruction: text,
        timerSeconds: z
          .number()
          .int()
          .positive()
          .max(86400)
          .nullable()
          .default(null),
      }),
    )
    .min(1)
    .max(100),
  preparationSteps: z.array(recipeStepSchema).max(100).optional(),
  notes: z.string().max(8000).default(""),
});
export type RecipeData = z.infer<typeof recipeSchema>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = RecipeData & { id: string; kind: "recipe" };
export type Food = {
  id: string;
  kind: "food";
  title: string;
  mealCategories: Category[];
  calories: number;
  amount: number;
  unit: Unit;
};
export type LibraryItem = Recipe | Food;
export type Entry = {
  id: string;
  date: string;
  category: Category;
  quantity: number;
  status: "planned" | "eaten";
  item: LibraryItem;
};
export type Target = { id: string; date: string; calories: number };
export type Grocery = {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  checked: boolean;
  excluded: boolean;
};
export type GroceryList = {
  id: string;
  from: string;
  to: string;
  items: Grocery[];
  createdAt: string;
};
export type Data = {
  library: LibraryItem[];
  entries: Entry[];
  targets: Target[];
  groceries: GroceryList[];
};
export type Bucket = keyof Data;
export type RecordType = LibraryItem | Entry | Target | GroceryList;
export const emptyData = (): Data => ({
  library: [],
  entries: [],
  targets: [],
  groceries: [],
});
export const id = () => crypto.randomUUID();
export const today = () => localDate(new Date());
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(date: string, count: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + count);
  return localDate(d);
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
}
export const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString();
export function calories(item: LibraryItem, quantity: number) {
  return item.kind === "recipe"
    ? (item.totalCaloriesKcal / item.servings) * quantity
    : (item.calories / item.amount) * quantity;
}
export function targetOn(targets: Target[], date: string): number | null {
  return (
    [...targets]
      .filter((t) => t.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.calories ?? null
  );
}
export function totals(entries: Entry[], date: string) {
  return entries
    .filter((e) => e.date === date)
    .reduce(
      (out, e) => {
        out[e.status] += calories(e.item, e.quantity);
        return out;
      },
      { eaten: 0, planned: 0 },
    );
}
export function parseRecipe(raw: string): RecipeData {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(
      "This is not valid JSON. Copy the complete recipe from ChatGPT and try again.",
    );
  }
  const result = recipeSchema.safeParse(parsed);
  if (!result.success)
    throw new Error(
      result.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".") || "Recipe"}: ${i.message}`)
        .join("\n"),
    );
  return result.data;
}
export function buildGroceries(
  entries: Entry[],
  from: string,
  to: string,
): Grocery[] {
  const combined = new Map<string, Grocery>();
  for (const entry of entries.filter(
    (e) => e.date >= from && e.date <= to && e.status === "planned",
  )) {
    const ingredients: Ingredient[] =
      entry.item.kind === "recipe"
        ? entry.item.ingredients.map((i) => ({
            ...i,
            quantity:
              (i.quantity * entry.quantity) / (entry.item as Recipe).servings,
          }))
        : [
            {
              name: entry.item.title,
              quantity: entry.quantity,
              unit: entry.item.unit,
              preparation: "",
            },
          ];
    for (const ingredient of ingredients) {
      let { unit, quantity } = ingredient;
      if (unit === "kg") {
        unit = "g";
        quantity *= 1000;
      }
      if (unit === "l") {
        unit = "ml";
        quantity *= 1000;
      }
      const name = ingredient.name.trim().replace(/\s+/g, " ");
      const key = `${name.toLocaleLowerCase()}|${unit}`;
      const existing = combined.get(key);
      if (existing) existing.quantity += quantity;
      else
        combined.set(key, {
          id: id(),
          name,
          quantity,
          unit,
          checked: false,
          excluded: false,
        });
    }
  }
  return [...combined.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export const importPrompt = `Create a recipe matching my request. Return ONLY valid JSON using this structure (replace the example):
{
  "schemaVersion": 1,
  "title": "Recipe name",
  "description": "Short description",
  "mealCategories": ["dinner"],
  "servings": 2,
  "totalCaloriesKcal": 850,
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 20,
  "ingredients": [{"name": "chicken breast", "quantity": 300, "unit": "g", "preparation": "cut into cubes"}],
  "preparationSteps": [{"instruction": "Cut the chicken into cubes and measure the other ingredients.", "timerSeconds": null}],
  "steps": [{"instruction": "Write each complete cooking instruction here.", "timerSeconds": null}],
  "notes": "Calories are estimates; state significant assumptions here."
}
Rules:
- All quantities and totalCaloriesKcal are for the WHOLE recipe. Include every ingredient, oil, sauce and topping in the calorie estimate.
- Allowed mealCategories: breakfast, lunch, dinner, snack. Include all appropriate categories.
- Units: g, kg, ml, l, piece, tsp, tbsp. Prefer grams and millilitres. Use numeric quantities (0.5, not fractions or ranges).
- Use consistent simple ingredient names; place preparation details separately. For pieces, state assumed size/weight in preparation.
- Every ingredient needs a definite quantity. Put optional extras in notes, outside the calculated recipe.
- Put all work needed BEFORE cooking in preparationSteps: washing, peeling, chopping, measuring, draining, mixing and preheating when appropriate. Ingredient preparation notes alone are not enough: write explicit, actionable preparation instructions. Keep size/weight assumptions in notes or ingredient preparation, not as actions.
- Put cooking and serving actions in steps. Do not repeat completed preparation actions in cooking steps. Both arrays are ordered; preparationSteps may be empty only when no preparation is needed.
- Use °C. timerSeconds is a positive integer for a useful countdown, otherwise null.
- Include all fields; no Markdown fences, comments or trailing commas.
My recipe request: [Describe the meal, servings, preferences and optional calorie goal per serving.]`;
