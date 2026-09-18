import { describe, expect, it } from "vitest";
import {
  addDays,
  buildGroceries,
  calories,
  parseRecipe,
  targetOn,
  totals,
  type Entry,
  type Food,
  type Recipe,
} from "./domain";
const recipe: Recipe = {
  id: "recipe",
  kind: "recipe",
  schemaVersion: 1,
  title: "Soup",
  description: "",
  servings: 4,
  totalCaloriesKcal: 1200,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  mealCategories: ["dinner"],
  ingredients: [
    { name: "Potato", quantity: 1, unit: "kg", preparation: "" },
    { name: "Water", quantity: 1, unit: "l", preparation: "" },
  ],
  steps: [{ instruction: "Cook.", timerSeconds: 1200 }],
  notes: "",
};
const food: Food = {
  id: "food",
  kind: "food",
  title: "potato",
  amount: 100,
  unit: "g",
  calories: 80,
  mealCategories: ["dinner"],
};
const entry = (patch: Partial<Entry> = {}): Entry => ({
  id: "entry",
  date: "2026-09-18",
  category: "dinner",
  quantity: 1,
  status: "planned",
  item: recipe,
  ...patch,
});
describe("calorie accounting", () => {
  it("scales fractional recipe portions and foods per 100 grams", () => {
    expect(calories(recipe, 0.5)).toBe(150);
    expect(calories(food, 250)).toBe(200);
  });
  it("keeps planned calories out of consumed totals and separates dates", () => {
    expect(
      totals(
        [
          entry(),
          entry({ status: "eaten", quantity: 2 }),
          entry({ date: "2026-09-19", status: "eaten" }),
        ],
        "2026-09-18",
      ),
    ).toEqual({ planned: 300, eaten: 600 });
  });
  it("preserves a recorded snapshot when the recipe changes", () => {
    const logged = entry({ item: structuredClone(recipe), status: "eaten" });
    const edited = { ...recipe, totalCaloriesKcal: 3000 };
    expect(calories(logged.item, 1)).toBe(300);
    expect(calories(edited, 1)).toBe(750);
  });
  it("uses the target effective on each day without inventing past targets", () => {
    const targets = [
      { id: "1", date: "2026-09-18", calories: 2000 },
      { id: "2", date: "2026-09-22", calories: 2100 },
    ];
    expect(targetOn(targets, "2026-09-17")).toBeNull();
    expect(targetOn(targets, "2026-09-21")).toBe(2000);
    expect(targetOn(targets, "2026-09-22")).toBe(2100);
  });
});
describe("grocery list", () => {
  it("scales recipe quantities, combines kg/g and includes individual foods", () => {
    const rows = buildGroceries(
      [entry({ quantity: 2 }), entry({ item: food, quantity: 150 })],
      "2026-09-18",
      "2026-09-20",
    );
    expect(rows.find((r) => r.name === "Potato")).toMatchObject({
      quantity: 650,
      unit: "g",
    });
    expect(rows.find((r) => r.name === "Water")).toMatchObject({
      quantity: 500,
      unit: "ml",
    });
  });
  it("excludes eaten and out-of-range entries", () => {
    expect(
      buildGroceries(
        [entry({ status: "eaten" }), entry({ date: "2026-09-21" })],
        "2026-09-18",
        "2026-09-20",
      ),
    ).toHaveLength(0);
  });
  it("does not guess conversions between pieces and grams", () => {
    const rows = buildGroceries(
      [entry(), entry({ item: { ...food, unit: "piece" }, quantity: 2 })],
      "2026-09-18",
      "2026-09-18",
    );
    expect(rows.filter((r) => r.name.toLowerCase() === "potato")).toHaveLength(
      2,
    );
  });
});
describe("recipe import and dates", () => {
  it("accepts the agreed JSON and optional Markdown wrappers", () => {
    expect(
      parseRecipe("```json\n" + JSON.stringify(recipe) + "\n```").title,
    ).toBe("Soup");
  });
  it("rejects malformed input, zero servings, negative ingredients and unsupported units", () => {
    expect(() => parseRecipe("{bad")).toThrow("valid JSON");
    expect(() =>
      parseRecipe(JSON.stringify({ ...recipe, servings: 0 })),
    ).toThrow("servings");
    expect(() =>
      parseRecipe(
        JSON.stringify({
          ...recipe,
          ingredients: [{ name: "Flour", quantity: -1, unit: "cup" }],
        }),
      ),
    ).toThrow("ingredients");
  });
  it("handles month and year boundaries as local dates", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("preparation steps", () => {
  it("imports explicit preparation actions separately from cooking", () => {
    const preparationSteps = [
      { instruction: "Slice the onion.", timerSeconds: 30 },
    ];
    const parsed = parseRecipe(JSON.stringify({ ...recipe, preparationSteps }));
    expect(parsed.preparationSteps).toEqual(preparationSteps);
    expect(parsed.steps).toEqual(recipe.steps);
  });
  it("keeps legacy recipes compatible without inventing actions from ingredient notes", () => {
    const parsed = parseRecipe(JSON.stringify(recipe));
    expect(parsed.preparationSteps ?? []).toEqual([]);
    expect(parsed.ingredients).toEqual(recipe.ingredients);
    expect(
      parseRecipe(JSON.stringify({ ...recipe, preparationSteps: [] }))
        .preparationSteps,
    ).toEqual([]);
  });
  it("rejects invalid preparation instructions and timers", () => {
    expect(() =>
      parseRecipe(
        JSON.stringify({
          ...recipe,
          preparationSteps: [{ instruction: "", timerSeconds: 0 }],
        }),
      ),
    ).toThrow("preparationSteps");
  });
});
