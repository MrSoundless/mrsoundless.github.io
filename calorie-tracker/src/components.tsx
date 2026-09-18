import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  X,
  Plus,
  Trash2,
  Clock,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  categories,
  units,
  id,
  calories,
  fmt,
  parseRecipe,
  importPrompt,
  today,
  type Category,
  type Recipe,
  type RecipeStep,
  type LibraryItem,
  type Entry,
  type Ingredient,
  type Unit,
} from "./domain";
import { useStore } from "./store";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function CategoryPicker({
  value,
  onChange,
}: {
  value: Category[];
  onChange: (value: Category[]) => void;
}) {
  return (
    <fieldset className="category-picker">
      <legend>Meal categories</legend>
      <div className="chips">
        {categories.map((c) => (
          <label
            key={c}
            className={`chip ${value.includes(c) ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={value.includes(c)}
              onChange={() =>
                onChange(
                  value.includes(c)
                    ? value.filter((v) => v !== c)
                    : [...value, c],
                )
              }
            />
            {c}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-plate">◌</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="error">
      {error}
    </p>
  ) : null;
}
export function FoodEditor({
  item,
  onClose,
}: {
  item?: LibraryItem;
  onClose: () => void;
}) {
  const { save, busy } = useStore();
  const [mealCategories, setCategories] = useState<Category[]>(
    item?.mealCategories ?? ["snack"],
  );
  const [error, setError] = useState("");
  const food = item?.kind === "food" ? item : undefined;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!String(form.get("title")).trim())
      return setError("Enter a food name.");
    if (!mealCategories.length)
      return setError("Choose at least one meal category.");
    try {
      await save("library", {
        id: food?.id ?? id(),
        kind: "food",
        title: String(form.get("title")).trim(),
        mealCategories,
        calories: Number(form.get("calories")),
        amount: Number(form.get("amount")),
        unit: form.get("unit") as Unit,
      });
      onClose();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <Modal title={food ? "Edit food" : "Add a food"} onClose={onClose}>
      <form onSubmit={submit} className="form-stack">
        <label>
          Name
          <input
            name="title"
            placeholder="e.g. Skyr or slice of bread"
            required
            maxLength={200}
            defaultValue={food?.title}
          />
        </label>
        <div className="form-row">
          <label>
            Calories (kcal)
            <input
              name="calories"
              type="number"
              min="0"
              max="1000000"
              step="any"
              required
              defaultValue={food?.calories}
            />
          </label>
          <label>
            Per quantity
            <input
              name="amount"
              type="number"
              min="0.01"
              max="1000000"
              step="any"
              required
              defaultValue={food?.amount ?? 100}
            />
          </label>
          <label>
            Unit
            <select name="unit" defaultValue={food?.unit ?? "g"}>
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">
          For a slice of bread, enter calories per 1 piece. For skyr, you could
          enter calories per 100 g.
        </p>
        <CategoryPicker value={mealCategories} onChange={setCategories} />
        <ErrorText error={error} />
        <button className="primary" disabled={busy}>
          Save food
        </button>
      </form>
    </Modal>
  );
}
export function RecipeEditor({
  recipe,
  onClose,
}: {
  recipe?: Recipe;
  onClose: () => void;
}) {
  const { save, busy } = useStore();
  const [mealCategories, setCategories] = useState<Category[]>(
    recipe?.mealCategories ?? ["dinner"],
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients ?? [
      { name: "", quantity: 100, unit: "g", preparation: "" },
    ],
  );
  const [preparationSteps, setPreparationSteps] = useState<RecipeStep[]>(
    recipe?.preparationSteps ?? [],
  );
  const [steps, setSteps] = useState(
    recipe?.steps ?? [{ instruction: "", timerSeconds: null as number | null }],
  );
  const [error, setError] = useState("");
  function ingredient(index: number, patch: Partial<Ingredient>) {
    setIngredients((list) =>
      list.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const parsed = parseRecipe(
        JSON.stringify({
          schemaVersion: 1,
          title: form.get("title"),
          description: form.get("description"),
          servings: Number(form.get("servings")),
          totalCaloriesKcal: Number(form.get("calories")),
          prepTimeMinutes: Number(form.get("prep")),
          cookTimeMinutes: Number(form.get("cook")),
          notes: form.get("notes"),
          mealCategories,
          ingredients,
          preparationSteps,
          steps,
        }),
      );
      await save("library", {
        ...parsed,
        kind: "recipe",
        id: recipe?.id ?? id(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Modal title={recipe ? "Edit recipe" : "Create a recipe"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Recipe name
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={recipe?.title}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={2}
            defaultValue={recipe?.description}
          />
        </label>
        <div className="form-row">
          <label>
            Servings
            <input
              name="servings"
              type="number"
              min="0.01"
              step="any"
              required
              defaultValue={recipe?.servings ?? 2}
            />
          </label>
          <label>
            Whole recipe kcal
            <input
              name="calories"
              type="number"
              min="0"
              step="any"
              required
              defaultValue={recipe?.totalCaloriesKcal}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Prep minutes
            <input
              name="prep"
              type="number"
              min="0"
              defaultValue={recipe?.prepTimeMinutes ?? 0}
            />
          </label>
          <label>
            Cook minutes
            <input
              name="cook"
              type="number"
              min="0"
              defaultValue={recipe?.cookTimeMinutes ?? 0}
            />
          </label>
        </div>
        <CategoryPicker value={mealCategories} onChange={setCategories} />
        <h3>
          Ingredients <small>for the whole recipe</small>
        </h3>
        {ingredients.map((item, i) => (
          <div className="editor-block" key={i}>
            <label>
              Ingredient {i + 1}
              <input
                aria-label={`Ingredient ${i + 1} name`}
                value={item.name}
                onChange={(e) => ingredient(i, { name: e.target.value })}
                required
              />
            </label>
            <div className="form-row">
              <label>
                Quantity
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={item.quantity || ""}
                  onChange={(e) =>
                    ingredient(i, { quantity: Number(e.target.value) })
                  }
                  required
                />
              </label>
              <label>
                Unit
                <select
                  value={item.unit}
                  onChange={(e) =>
                    ingredient(i, { unit: e.target.value as Unit })
                  }
                >
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Remove ingredient ${i + 1}`}
                disabled={ingredients.length === 1}
                onClick={() =>
                  setIngredients((list) =>
                    list.filter((_, index) => index !== i),
                  )
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
            <label>
              Preparation <small>optional</small>
              <input
                value={item.preparation}
                onChange={(e) => ingredient(i, { preparation: e.target.value })}
                placeholder="e.g. finely chopped"
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setIngredients((list) => [
              ...list,
              { name: "", quantity: 1, unit: "piece", preparation: "" },
            ])
          }
        >
          <Plus size={16} /> Add ingredient
        </button>
        <section className="form-stack">
          <h3>Preparation steps</h3>
          <p className="hint">
            What needs doing before cooking? Add washing, chopping, measuring,
            mixing, or preheating as separate actions.
          </p>
          {preparationSteps.map((step, index) => (
            <div className="editor-block" key={index}>
              <label>
                Preparation step {index + 1}
                <textarea
                  required
                  value={step.instruction}
                  onChange={(e) =>
                    setPreparationSteps((list) =>
                      list.map((s, i) =>
                        i === index ? { ...s, instruction: e.target.value } : s,
                      ),
                    )
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Timer seconds <small>optional</small>
                  <input
                    aria-label={
                      "Preparation step " + (index + 1) + " timer seconds"
                    }
                    type="number"
                    min="1"
                    max="86400"
                    value={step.timerSeconds ?? ""}
                    onChange={(e) =>
                      setPreparationSteps((list) =>
                        list.map((s, i) =>
                          i === index
                            ? {
                                ...s,
                                timerSeconds: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : s,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={"Remove preparation step " + (index + 1)}
                  onClick={() =>
                    setPreparationSteps((list) =>
                      list.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setPreparationSteps((list) => [
                ...list,
                { instruction: "", timerSeconds: null },
              ])
            }
          >
            <Plus size={16} />
            Add preparation step
          </button>
        </section>
        <h3>Cooking steps</h3>
        {steps.map((step, i) => (
          <div className="editor-block" key={i}>
            <label>
              Step {i + 1}
              <textarea
                required
                value={step.instruction}
                onChange={(e) =>
                  setSteps((list) =>
                    list.map((s, index) =>
                      index === i ? { ...s, instruction: e.target.value } : s,
                    ),
                  )
                }
              />
            </label>
            <div className="form-row">
              <label>
                Timer seconds <small>optional</small>
                <input
                  type="number"
                  min="1"
                  max="86400"
                  value={step.timerSeconds ?? ""}
                  onChange={(e) =>
                    setSteps((list) =>
                      list.map((s, index) =>
                        index === i
                          ? {
                              ...s,
                              timerSeconds: e.target.value
                                ? Number(e.target.value)
                                : null,
                            }
                          : s,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Remove step ${i + 1}`}
                disabled={steps.length === 1}
                onClick={() =>
                  setSteps((list) => list.filter((_, index) => index !== i))
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setSteps((list) => [
              ...list,
              { instruction: "", timerSeconds: null },
            ])
          }
        >
          <Plus size={16} /> Add step
        </button>
        <label>
          Notes
          <textarea name="notes" defaultValue={recipe?.notes} />
        </label>
        <ErrorText error={error} />
        <button className="primary" disabled={busy}>
          Save recipe
        </button>
      </form>
    </Modal>
  );
}
export function ImportRecipe({ onClose }: { onClose: () => void }) {
  const { save, busy } = useStore();
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  if (editing && parsed)
    return <RecipeEditor recipe={parsed} onClose={onClose} />;
  return (
    <Modal title="Import from ChatGPT" onClose={onClose}>
      <div className="form-stack">
        <p>
          Paste your recipe JSON, review the calories and portions, then add it
          to your library.
        </p>
        <details>
          <summary>Get the ChatGPT prompt</summary>
          <textarea
            aria-label="ChatGPT prompt"
            readOnly
            value={importPrompt}
            rows={7}
          />
          <button
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(importPrompt);
                setCopied(true);
              } catch {
                setError(
                  "Select and copy the prompt above. Clipboard access is unavailable.",
                );
              }
            }}
          >
            <Copy size={16} />
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </details>
        <label>
          Recipe JSON
          <textarea
            className="code-input"
            rows={9}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setParsed(null);
              setError("");
            }}
            placeholder={'{ "schemaVersion": 1, "title": "…" }'}
          />
        </label>
        <ErrorText error={error} />
        {!parsed ? (
          <button
            className="primary"
            disabled={!raw.trim()}
            onClick={() => {
              try {
                setParsed({ ...parseRecipe(raw), kind: "recipe", id: id() });
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Review recipe
          </button>
        ) : (
          <section className="import-preview">
            <span className="eyebrow">Ready to review</span>
            <h3>{parsed.title}</h3>
            <p>{parsed.description}</p>
            <div className="chips">
              <span className="badge">{fmt(parsed.servings)} servings</span>
              <span className="badge">
                {fmt(parsed.totalCaloriesKcal / parsed.servings)} kcal / serving
              </span>
            </div>
            <p>
              {fmt(parsed.totalCaloriesKcal)} kcal for the whole recipe ·{" "}
              {parsed.ingredients.length} ingredients ·{" "}
              {parsed.preparationSteps?.length ?? 0} preparation steps ·{" "}
              {parsed.steps.length} cooking steps
            </p>
            <ul>
              {parsed.ingredients.map((i, index) => (
                <li key={index}>
                  {fmt(i.quantity)} {i.unit} {i.name}
                </li>
              ))}
            </ul>
            <p className="hint">
              Calories are estimates. Check them against your ingredients.
            </p>
            <div>
              <h3>Preparation</h3>
              {parsed.preparationSteps?.length ? (
                <ol>
                  {parsed.preparationSteps.map((step, i) => (
                    <li key={i}>{step.instruction}</li>
                  ))}
                </ol>
              ) : (
                <p className="hint">
                  No separate preparation steps in this recipe. Use Edit details
                  to add them; the original cooking instructions are preserved.
                </p>
              )}
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => setEditing(true)}>
                Edit details
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  try {
                    await save("library", parsed);
                    onClose();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Save recipe
              </button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
export function EntryEditor({
  entry,
  initialItem,
  initialStatus,
  date,
  category,
  onClose,
}: {
  entry?: Entry;
  initialItem?: LibraryItem;
  initialStatus?: "planned" | "eaten";
  date: string;
  category?: Category;
  onClose: () => void;
}) {
  const { data, save, busy } = useStore();
  const [item, setItem] = useState<LibraryItem | undefined>(
    entry?.item ?? initialItem,
  );
  const [meal, setMeal] = useState<Category>(
    entry?.category ?? category ?? "dinner",
  );
  const [day, setDay] = useState(entry?.date ?? date);
  const [status, setStatus] = useState<"planned" | "eaten">(
    entry?.status ?? initialStatus ?? (date > today() ? "planned" : "eaten"),
  );
  const [quantity, setQuantity] = useState(
    entry?.quantity ?? (initialItem?.kind === "food" ? initialItem.amount : 1),
  );
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    try {
      await save("entries", {
        id: entry?.id ?? id(),
        date: day,
        category: meal,
        status,
        quantity,
        item: structuredClone(item),
      });
      onClose();
    } catch (e) {
      setError(String(e));
    }
  }
  const filtered = data.library.filter(
    (i) =>
      (all || i.mealCategories.includes(meal)) &&
      i.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Modal title={entry ? "Edit meal" : "Add to your day"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-row">
          <label>
            Date
            <input
              type="date"
              required
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                if (e.target.value > today()) setStatus("planned");
              }}
            />
          </label>
          <label>
            Meal
            <select
              value={meal}
              onChange={(e) => setMeal(e.target.value as Category)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {!item ? (
          <>
            <label>
              Search your library
              <input
                type="search"
                placeholder="Find a recipe or food…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => setAll(e.target.checked)}
              />
              Show all meal categories
            </label>
            <div className="picker-list">
              {filtered.map((i) => (
                <button
                  type="button"
                  className="picker-item"
                  key={i.id}
                  onClick={() => {
                    setItem(i);
                    setQuantity(i.kind === "recipe" ? 1 : i.amount);
                  }}
                >
                  <span>
                    <strong>{i.title}</strong>
                    <small>
                      {i.kind === "recipe"
                        ? "Recipe · per serving"
                        : `${i.amount} ${i.unit}`}
                    </small>
                  </span>
                  <span>
                    {fmt(calories(i, i.kind === "recipe" ? 1 : i.amount))} kcal
                  </span>
                </button>
              ))}
              {!filtered.length && (
                <p className="hint">
                  No matching foods. Try all categories, or add recipes and
                  foods in Library first.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="selection">
              <div>
                <span className="eyebrow">{item.kind}</span>
                <h3>{item.title}</h3>
              </div>
              {!entry && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setItem(undefined)}
                >
                  Change
                </button>
              )}
            </div>
            <label>
              {item.kind === "recipe"
                ? "Servings to eat"
                : `Quantity (${item.unit})`}
              <input
                type="number"
                required
                min="0.001"
                max="1000000"
                step="any"
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <div className="calorie-preview">
              {fmt(calories(item, quantity))}
              <span>kcal</span>
            </div>
            <label>
              Status
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "planned" | "eaten")
                }
              >
                <option value="planned">Planned</option>
                <option value="eaten" disabled={day > today()}>
                  Eaten
                </option>
              </select>
            </label>
            <p className="hint">
              Planned meals only count toward consumed calories once you mark
              them as eaten.
            </p>
            <ErrorText error={error} />
            <button className="primary" disabled={busy}>
              {entry
                ? "Save changes"
                : status === "planned"
                  ? "Plan meal"
                  : "Log food"}
            </button>
          </>
        )}
      </form>
    </Modal>
  );
}
export function Cooking({
  recipe,
  initialServings,
  onClose,
}: {
  recipe: Recipe;
  initialServings?: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState(-1);
  const [servings, setServings] = useState(initialServings ?? recipe.servings);
  const [checked, setChecked] = useState<number[]>([]);
  const [timers, setTimers] = useState<
    Record<number, { end: number; paused: number | null }>
  >({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
  const remaining = (timer: { end: number; paused: number | null }) =>
    Math.max(0, timer.paused ?? Math.ceil((timer.end - now) / 1000));
  const preparation = recipe.preparationSteps ?? [];
  const allSteps = [...preparation, ...recipe.steps];
  const preparing = step >= 0 && step < preparation.length;
  const phase =
    step < 0 ? "Ingredients" : preparing ? "Preparation" : "Cooking";
  const phaseIndex = preparing ? step : step - preparation.length;
  const current = allSteps[step];
  const stepLabel = (index: number) =>
    index < preparation.length
      ? "Preparation · step " + (index + 1)
      : "Cooking · step " + (index - preparation.length + 1);
  return (
    <Modal title={recipe.title} onClose={onClose}>
      <div className="form-stack">
        <ol className="cooking-phases" aria-label="Recipe phases">
          {["Ingredients", "Preparation", "Cooking"].map((name) => (
            <li
              key={name}
              aria-current={phase === name ? "step" : undefined}
              className={phase === name ? "active" : ""}
            >
              {name}
            </li>
          ))}
        </ol>
        <div className="cook-progress">
          <span>
            {step < 0
              ? "Gather your ingredients"
              : `${phase} · step ${phaseIndex + 1} of ${preparing ? preparation.length : recipe.steps.length}`}
          </span>
          <span>
            <Clock size={15} />{" "}
            {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
          </span>
        </div>
        <progress
          aria-label="Recipe progress"
          max={allSteps.length + 1}
          value={step + 2}
        />
        {step === -1 ? (
          <>
            <label>
              Servings to prepare
              <input
                type="number"
                min="0.01"
                step="any"
                value={servings || ""}
                onChange={(e) =>
                  setServings(Math.max(0, Number(e.target.value)))
                }
              />
            </label>
            <div className="ingredient-list">
              {recipe.ingredients.map((i, index) => (
                <label
                  className={`ingredient-check ${checked.includes(index) ? "done" : ""}`}
                  key={index}
                >
                  <input
                    type="checkbox"
                    checked={checked.includes(index)}
                    onChange={() =>
                      setChecked((list) =>
                        list.includes(index)
                          ? list.filter((x) => x !== index)
                          : [...list, index],
                      )
                    }
                  />
                  <span>
                    <strong>
                      {fmt((i.quantity * servings) / recipe.servings)} {i.unit}
                    </strong>{" "}
                    {i.name}
                    <small>{i.preparation}</small>
                  </span>
                </label>
              ))}
            </div>
            {recipe.notes && <p className="hint">{recipe.notes}</p>}
            {!preparation.length && (
              <p className="hint">
                No separate preparation steps are saved. Check the ingredient
                notes and cooking instructions before starting. You can add a
                preparation phase in Edit recipe.
              </p>
            )}
          </>
        ) : (
          <div className="cooking-step">
            <span className="step-number">
              {String(phaseIndex + 1).padStart(2, "0")}
            </span>
            <p>{current.instruction}</p>
            {current.timerSeconds && !timers[step] && (
              <button
                className="secondary"
                onClick={() =>
                  setTimers((t) => ({
                    ...t,
                    [step]: {
                      end: Date.now() + current.timerSeconds! * 1000,
                      paused: null,
                    },
                  }))
                }
              >
                <Clock size={18} />
                Start {fmt(current.timerSeconds / 60)} min timer
              </button>
            )}
          </div>
        )}
        {Object.entries(timers).map(([index, timer]) => {
          const seconds = remaining(timer);
          return (
            <div
              className={`timer ${seconds === 0 ? "finished" : ""}`}
              key={index}
            >
              <div>
                <small>{stepLabel(Number(index))}</small>
                <strong role={seconds === 0 ? "status" : undefined}>
                  {seconds === 0
                    ? "Timer finished"
                    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
                </strong>
              </div>
              <div className="actions">
                {seconds > 0 && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setTimers((t) => ({
                        ...t,
                        [index]:
                          timer.paused === null
                            ? { ...timer, paused: seconds }
                            : {
                                end: Date.now() + seconds * 1000,
                                paused: null,
                              },
                      }))
                    }
                  >
                    {timer.paused === null ? "Pause" : "Resume"}
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={`Remove timer for ${stepLabel(Number(index))}`}
                  onClick={() =>
                    setTimers((t) =>
                      Object.fromEntries(
                        Object.entries(t).filter(([key]) => key !== index),
                      ),
                    )
                  }
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          );
        })}
        {Object.keys(timers).length > 0 && (
          <p className="hint">
            Keep cooking mode open to see your timers. Timers do not send
            background notifications.
          </p>
        )}
        <div className="actions spread">
          <button
            className="secondary"
            disabled={step < 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft size={18} />
            Back
          </button>
          {step < allSteps.length - 1 ? (
            <button className="primary" onClick={() => setStep((s) => s + 1)}>
              {step < 0
                ? preparation.length
                  ? "Start preparation"
                  : "Start cooking"
                : step === preparation.length - 1
                  ? "Start cooking"
                  : "Next step"}
              <ChevronRight size={18} />
            </button>
          ) : (
            <button className="primary" onClick={onClose}>
              <Check size={18} />
              Finish cooking
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
