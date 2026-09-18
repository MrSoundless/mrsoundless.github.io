import { test, expect, type Page } from "@playwright/test";
const recipe = {
  schemaVersion: 1,
  title: "Weekend tomato soup",
  description: "An easy lunch.",
  servings: 2,
  totalCaloriesKcal: 600,
  prepTimeMinutes: 5,
  cookTimeMinutes: 15,
  mealCategories: ["lunch", "dinner"],
  ingredients: [
    { name: "Tomatoes", quantity: 500, unit: "g", preparation: "chopped" },
    { name: "Water", quantity: 0.5, unit: "l", preparation: "" },
  ],
  steps: [
    { instruction: "Combine tomatoes and water.", timerSeconds: null },
    { instruction: "Simmer the soup.", timerSeconds: 2 },
  ],
  notes: "Calories are estimates.",
};
async function preview(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Explore an empty preview" }).click();
}
async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function importRecipe(page: Page) {
  await navigate(page, "Library");
  await page
    .getByRole("button", { name: "Import recipe", exact: true })
    .click();
  await page.getByLabel("Recipe JSON").fill(JSON.stringify(recipe));
  await page.getByRole("button", { name: "Review recipe" }).click();
  await expect(page.getByText("300 kcal / serving")).toBeVisible();
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
}
test("food logging, portions, target and history work together", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await preview(page);
  await page.getByRole("button", { name: "Account and settings" }).click();
  await page.getByLabel("Target (kcal)").fill("2000");
  await page.getByRole("button", { name: "Save target" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await navigate(page, "Library");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Skyr");
  await page.getByLabel("Calories (kcal)").fill("60");
  await page.getByRole("button", { name: "Save food" }).click();
  await page.getByRole("button", { name: "Add to day" }).click();
  await page.getByLabel("Quantity (g)").fill("250");
  await expect(page.getByText("150kcal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log food" }).click();
  await navigate(page, "Today");
  await expect(page.getByText("1,850 kcal remaining")).toBeVisible();
  await expect(page.getByText("Skyr", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Skyr entry" }).click();
  await page.getByLabel("Quantity (g)").fill("200");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("1,880 kcal remaining")).toBeVisible();
  await navigate(page, "History");
  await expect(
    page.getByRole("cell", { name: "120 kcal", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("recipe import, future planning, grocery list and cooking", async ({
  page,
}) => {
  await preview(page);
  await importRecipe(page);
  await page.getByRole("button", { name: "Add to day" }).click();
  const tomorrow = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  });
  await page.getByLabel("Date", { exact: true }).fill(tomorrow);
  await page.getByLabel("Servings to eat").fill("1");
  await page.getByRole("button", { name: "Plan meal", exact: true }).click();
  await navigate(page, "Plan");
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(
    page.getByText("Weekend tomato soup", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("planned", { exact: true })).toBeVisible();
  await navigate(page, "Groceries");
  await page.getByRole("button", { name: "Generate list" }).click();
  await expect(page.getByText("250 g", { exact: true })).toBeVisible();
  await expect(page.getByText("250 ml", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Tomatoes 250 g" }).check();
  await expect(page.getByText("1 of 2 items picked up")).toBeVisible();
  await page
    .getByRole("button", { name: "Have it", exact: true })
    .last()
    .click();
  await page.getByText("Already at home (1)").click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByLabel("Item", { exact: true }).fill("Bread");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText("Bread", { exact: true })).toBeVisible();
  await navigate(page, "Library");
  await page
    .getByRole("button", { name: "Cook Weekend tomato soup", exact: true })
    .click();
  await page.getByLabel("Servings to prepare").fill("1");
  await expect(page.getByText("250 g", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start cooking" }).click();
  await expect(
    page.getByText("Combine tomatoes and water.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: /Start .* min timer/ }).click();
  await expect(page.getByText("Timer finished", { exact: true })).toBeVisible({
    timeout: 6000,
  });
  await page.getByRole("button", { name: "Finish cooking" }).click();
  await navigate(page, "History");
  await expect(
    page.getByRole("cell", { name: "300 kcal", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("malformed recipes are rejected and editing library preserves logged calories", async ({
  page,
}) => {
  await preview(page);
  await navigate(page, "Library");
  await page
    .getByRole("button", { name: "Import recipe", exact: true })
    .click();
  await page.getByLabel("Recipe JSON").fill("{bad");
  await page.getByRole("button", { name: "Review recipe" }).click();
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await importRecipe(page);
  await page.getByRole("button", { name: "Add to day" }).click();
  await page.getByRole("button", { name: "Log food" }).click();
  await page
    .getByRole("button", { name: "Edit Weekend tomato soup", exact: true })
    .click();
  await page.getByLabel("Whole recipe kcal").fill("1000");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await navigate(page, "Today");
  await expect(page.getByText("1 servings · 300 kcal")).toBeVisible();
  await navigate(page, "Library");
  await page
    .getByRole("button", { name: "Delete Weekend tomato soup", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await navigate(page, "Today");
  await expect(page.getByText("1 servings · 300 kcal")).toBeVisible();
});

test("planning today requires explicit confirmation and supports portion adjustment", async ({
  page,
}) => {
  await preview(page);
  await importRecipe(page);
  await navigate(page, "Plan");
  await page.getByRole("button", { name: "Plan dinner", exact: true }).click();
  await page
    .getByRole("button", { name: /Weekend tomato soup Recipe/ })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("planned");
  await page
    .getByRole("button", { name: "Plan meal", exact: true })
    .last()
    .click();
  await navigate(page, "Today");
  await expect(page.getByText("0", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Mark eaten", exact: true }).click();
  await page.getByLabel("Servings to eat").fill("0.5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("0.5 servings · 150 kcal")).toBeVisible();
  await navigate(page, "History");
  await expect(
    page.getByRole("cell", { name: "150 kcal", exact: true }),
  ).toBeVisible();
});
test("manual recipes, category search and modal keyboard controls", async ({
  page,
}) => {
  await preview(page);
  await navigate(page, "Library");
  await page.getByRole("button", { name: "Recipe", exact: true }).click();
  await page.getByLabel("Recipe name").fill("Simple skyr bowl");
  await page.getByLabel("Whole recipe kcal").fill("120");
  await page.getByLabel("Ingredient 1 name").fill("Skyr");
  await page.getByLabel("Step 1", { exact: true }).fill("Spoon into a bowl.");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Simple skyr bowl" }),
  ).toBeVisible();
  await page.getByLabel("Search library").fill("bread");
  await expect(
    page.getByRole("heading", { name: "No matches yet" }),
  ).toBeVisible();
  await page.getByLabel("Search library").fill("skyr");
  await page.getByLabel("Filter by meal category").selectOption("breakfast");
  await expect(
    page.getByRole("heading", { name: "No matches yet" }),
  ).toBeVisible();
  await page.getByLabel("Filter by meal category").selectOption("dinner");
  await page.getByRole("button", { name: "Cook Simple skyr bowl" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("preparation precedes cooking, keeps phase timers separate and can be edited", async ({
  page,
}) => {
  await preview(page);
  await navigate(page, "Library");
  await page
    .getByRole("button", { name: "Import recipe", exact: true })
    .click();
  const prepared = {
    ...recipe,
    preparationSteps: [
      { instruction: "Wash and chop the tomatoes.", timerSeconds: 60 },
      { instruction: "Measure the water.", timerSeconds: null },
    ],
  };
  await page.getByLabel("Recipe JSON").fill(JSON.stringify(prepared));
  await page.getByRole("button", { name: "Review recipe" }).click();
  await expect(
    page.getByText("Wash and chop the tomatoes.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Weekend tomato soup", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Preparation step 1", exact: true })
    .fill("Rinse and chop the tomatoes.");
  await page
    .getByRole("button", { name: "Add preparation step", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Preparation step 3", exact: true })
    .fill("Set out the pan.");
  await page
    .getByRole("button", { name: "Remove preparation step 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page
    .getByRole("button", { name: "Cook Weekend tomato soup", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start preparation", exact: true })
    .click();
  await expect(
    page.getByText("Preparation · step 1 of 2", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Rinse and chop the tomatoes.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start 1 min timer" }).click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(
    page.getByText("Set out the pan.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await expect(
    page.getByText("Cooking · step 1 of 2", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Combine tomatoes and water.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Preparation · step 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByText("Set out the pan.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await page.getByRole("button", { name: /Start .* min timer/ }).click();
  await expect(
    page.getByText("Cooking · step 2", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

