import { useState, type FormEvent } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Download,
  Flame,
  History as HistoryIcon,
  Leaf,
  LogOut,
  Plus,
  Search,
  Settings,
  ShoppingBasket,
  Trash2,
  Utensils,
  X,
  Pencil,
} from "lucide-react";
import { useStore } from "./store";
import {
  addDays,
  buildGroceries,
  calories,
  categories,
  dateLabel,
  fmt,
  id,
  targetOn,
  today,
  totals,
  units,
  type Category,
  type Entry,
  type Grocery,
  type GroceryList,
  type LibraryItem,
  type Recipe,
  type Unit,
} from "./domain";
import {
  Cooking,
  Empty,
  EntryEditor,
  ErrorText,
  FoodEditor,
  ImportRecipe,
  Modal,
  RecipeEditor,
} from "./components";

type Tab = "diary" | "planner" | "library" | "groceries" | "history";
type Dialog =
  | { type: "food"; item?: LibraryItem }
  | { type: "recipe"; recipe?: Recipe }
  | { type: "import" }
  | {
      type: "entry";
      status?: "planned" | "eaten";
      entry?: Entry;
      item?: LibraryItem;
      date: string;
      category?: Category;
    }
  | { type: "cook"; recipe: Recipe; servings?: number }
  | { type: "settings" }
  | {
      type: "delete";
      bucket: "library" | "entries" | "groceries";
      id: string;
      title: string;
    };
const nav = [
  { id: "diary", title: "Today", icon: Utensils },
  { id: "planner", title: "Plan", icon: CalendarDays },
  { id: "library", title: "Library", icon: BookOpen },
  { id: "groceries", title: "Groceries", icon: ShoppingBasket },
  { id: "history", title: "History", icon: HistoryIcon },
] as const;
export default function App() {
  const store = useStore();
  const { data, user, demo, ready, configured, loading, busy, error, online } =
    store;
  const [tab, setTab] = useState<Tab>("diary");
  const [date, setDate] = useState(today());
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const close = () => setDialog(null);
  if (!ready)
    return (
      <main className="welcome">
        <div className="brand">
          <Leaf /> Plateful
        </div>
        <p>Getting things ready…</p>
      </main>
    );
  if (!user && !demo)
    return (
      <main className="welcome">
        <a className="home-link" href="../">
          ← All apps
        </a>
        <div className="welcome-layout">
          <div>
            <div className="brand">
              <Leaf /> Plateful
            </div>
            <span className="eyebrow">
              A little planning. A better everyday.
            </span>
            <h1>
              Make room
              <br />
              for good food.
            </h1>
            <p className="welcome-copy">
              Your recipes, your daily calories, and a plan for the week. All
              together, wherever you are.
            </p>
            <div className="welcome-features">
              <span>
                <BookOpen /> Keep your favorite recipes
              </span>
              <span>
                <CalendarDays /> Plan meals ahead
              </span>
              <span>
                <ShoppingBasket /> Shop with one simple list
              </span>
            </div>
            {configured ? (
              <button className="primary google-button" onClick={store.login}>
                <CircleUserRound size={20} />
                Continue with Google
                <ArrowRight size={18} />
              </button>
            ) : (
              <div className="setup-note">
                <strong>Cloud connection needs setup</strong>
                <p>
                  Google sign-in will be available once this site's Firebase
                  configuration is connected.
                </p>
              </div>
            )}
            <button
              className="text-button preview-button"
              onClick={store.startDemo}
            >
              Explore an empty preview <ArrowRight size={16} />
            </button>
            <p className="hint">
              Preview changes are temporary and disappear when you leave or
              reload.
            </p>
            <ErrorText error={error} />
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-caption">A plate of possibilities</div>
            <div className="plate">
              <div className="plate-inner">
                <span className="art-leaf leaf-one" />
                <span className="art-leaf leaf-two" />
                <span className="art-leaf leaf-three" />
                <span className="art-tomato tomato-one" />
                <span className="art-tomato tomato-two" />
                <span className="art-grain grain-one" />
                <span className="art-grain grain-two" />
                <span className="art-grain grain-three" />
              </div>
            </div>
            <span className="art-note">
              Simple ingredients.
              <br />
              Thoughtful days.
            </span>
          </div>
        </div>
      </main>
    );
  const dayTotals = totals(data.entries, date);
  const target = targetOn(data.targets, date);
  const entries = data.entries.filter((e) => e.date === date);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="../" className="brand">
          <Leaf />
          Plateful
        </a>
        <span className="sidebar-caption">GOOD FOOD, EVERY DAY</span>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={21} />
              <span>{n.title}</span>
              {tab === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Leaf size={24} />
            <p>
              A little intention.
              <br />A plate at a time.
            </p>
          </div>
          <button onClick={() => setDialog({ type: "settings" })}>
            <Settings size={20} />
            Settings
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="mobile-brand">
            <Leaf size={23} />
            Plateful
          </span>
          <span className="desktop-breadcrumb">
            Your everyday, thoughtfully planned.
          </span>
          <div className="account">
            <span className={`sync-dot ${online ? "" : "offline"}`} />
            <span>
              {demo
                ? "Temporary preview"
                : !online
                  ? "Offline"
                  : busy
                    ? "Saving…"
                    : loading
                      ? "Connecting…"
                      : "Connected"}
            </span>
            <button
              aria-label="Account and settings"
              className="avatar"
              onClick={() => setDialog({ type: "settings" })}
            >
              {demo ? (
                <CircleUserRound size={20} />
              ) : (
                user?.displayName?.slice(0, 1) || "U"
              )}
            </button>
          </div>
        </header>
        {demo && (
          <div className="notice">
            You're in preview mode. Changes are temporary.{" "}
            <button className="text-button" onClick={store.logout}>
              Exit preview
            </button>
          </div>
        )}
        {!online && (
          <div className="notice warning" role="status">
            You're offline. Reconnect to save changes and synchronize your data.
          </div>
        )}
        {error && (
          <div className="notice warning" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={store.clearError}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {loading ? (
          <main className="content">
            <Empty title="Connecting to your library">
              Your private data is loading. If this continues, check the
              connection and Firebase setup.
            </Empty>
            <button className="secondary" onClick={store.logout}>
              Sign out
            </button>
          </main>
        ) : (
          <main className="content">
            {tab === "diary" && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR DAILY CHECK-IN</span>
                    <h1>
                      {date === today()
                        ? "A fresh look at today."
                        : "Your day, on a plate."}
                    </h1>
                    <p>Keep track. Make space for what you love.</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setDialog({ type: "entry", date })}
                  >
                    <Plus size={18} />
                    Add food
                  </button>
                </div>
                <DateControl date={date} setDate={setDate} />
                <section className="daily-summary">
                  <div className="summary-main">
                    <div
                      className="ring"
                      style={
                        {
                          "--progress": `${Math.min(100, target ? (dayTotals.eaten / target) * 100 : 0)}%`,
                        } as React.CSSProperties
                      }
                    >
                      <div>
                        <Flame size={21} />
                        <strong>
                          {Math.round(dayTotals.eaten).toLocaleString()}
                        </strong>
                        <span>kcal eaten</span>
                      </div>
                    </div>
                    <div>
                      <span className="eyebrow">ONE DAY AT A TIME</span>
                      <h2>
                        {target === null
                          ? "Your day, your pace."
                          : dayTotals.eaten > target
                            ? `${fmt(dayTotals.eaten - target)} kcal over target`
                            : `${fmt(target - dayTotals.eaten)} kcal remaining`}
                      </h2>
                      <p>
                        {target === null
                          ? "Set a daily target to follow your progress."
                          : `Your daily target is ${fmt(target)} kcal.`}
                      </p>
                      <button
                        className="text-button light"
                        onClick={() => setDialog({ type: "settings" })}
                      >
                        {target === null ? "Set your target" : "Adjust target"}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="summary-footer">
                    <span>
                      <i className="legend-dot eaten-dot" />
                      Consumed <strong>{fmt(dayTotals.eaten)} kcal</strong>
                    </span>
                    <span>
                      <i className="legend-dot planned-dot" />
                      Still planned{" "}
                      <strong>{fmt(dayTotals.planned)} kcal</strong>
                    </span>
                    <span>
                      Day total if eaten{" "}
                      <strong>
                        {fmt(dayTotals.eaten + dayTotals.planned)} kcal
                      </strong>
                    </span>
                  </div>
                </section>
                <div className="section-heading">
                  <h2>On the menu</h2>
                  <span>
                    {entries.length}{" "}
                    {entries.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="meal-grid">
                  {categories.map((meal, index) => (
                    <section className="meal-card" key={meal}>
                      <div className="meal-head">
                        <div>
                          <span className={`meal-symbol symbol-${index}`}>
                            {["☀", "◒", "☾", "✧"][index]}
                          </span>
                          <h3>{meal === "snack" ? "Snacks" : meal}</h3>
                        </div>
                        <span>
                          {fmt(
                            entries
                              .filter(
                                (e) =>
                                  e.category === meal && e.status === "eaten",
                              )
                              .reduce(
                                (sum, e) => sum + calories(e.item, e.quantity),
                                0,
                              ),
                          )}{" "}
                          kcal eaten
                        </span>
                      </div>
                      {entries
                        .filter((e) => e.category === meal)
                        .map((entry) => (
                          <EntryRow
                            key={entry.id}
                            entry={entry}
                            open={setDialog}
                          />
                        ))}
                      {!entries.some((e) => e.category === meal) && (
                        <p className="meal-empty">
                          A little room for something good.
                        </p>
                      )}
                      <button
                        className="add-meal"
                        onClick={() =>
                          setDialog({ type: "entry", date, category: meal })
                        }
                      >
                        <Plus size={16} />
                        Add {meal}
                      </button>
                    </section>
                  ))}
                </div>
              </>
            )}
            {tab === "planner" && (
              <Planner date={date} setDate={setDate} open={setDialog} />
            )}
            {tab === "library" && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR PERSONAL COLLECTION</span>
                    <h1>Good things, saved.</h1>
                    <p>Recipes and everyday foods, ready when you are.</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setDialog({ type: "import" })}
                  >
                    <Download size={18} />
                    Import recipe
                  </button>
                </div>
                <div className="library-tools">
                  <label className="search-field">
                    <Search size={19} />
                    <input
                      aria-label="Search library"
                      type="search"
                      placeholder="Search your recipes and foods…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() => setDialog({ type: "food" })}
                    >
                      <Plus size={16} />
                      Food
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setDialog({ type: "recipe" })}
                    >
                      <Plus size={16} />
                      Recipe
                    </button>
                  </div>
                </div>
                <div className="filters">
                  <div className="tabs" aria-label="Library type">
                    {["all", "recipe", "food"].map((k) => (
                      <button
                        key={k}
                        className={kind === k ? "selected" : ""}
                        onClick={() => setKind(k)}
                      >
                        {k === "all"
                          ? "Everything"
                          : k === "recipe"
                            ? "Recipes"
                            : "Foods"}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="Filter by meal category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">All meals</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="library-grid">
                  {data.library
                    .filter(
                      (item) =>
                        (kind === "all" || item.kind === kind) &&
                        (category === "all" ||
                          item.mealCategories.includes(category as Category)) &&
                        item.title.toLowerCase().includes(search.toLowerCase()),
                    )
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((item) => (
                      <article className="library-card" key={item.id}>
                        <div
                          className={`recipe-art ${item.kind}`}
                          aria-hidden="true"
                        >
                          {item.kind === "recipe" ? (
                            <ChefHat size={45} strokeWidth={1} />
                          ) : (
                            <Utensils size={42} strokeWidth={1} />
                          )}
                          <span>
                            {item.kind === "recipe"
                              ? `${item.prepTimeMinutes + item.cookTimeMinutes} min`
                              : "Everyday food"}
                          </span>
                        </div>
                        <div className="library-card-body">
                          <div className="chips">
                            {item.mealCategories.map((c) => (
                              <span className="badge" key={c}>
                                {c}
                              </span>
                            ))}
                          </div>
                          <h3>{item.title}</h3>
                          <p>
                            {fmt(
                              calories(
                                item,
                                item.kind === "recipe" ? 1 : item.amount,
                              ),
                            )}{" "}
                            kcal{" "}
                            <span>
                              /{" "}
                              {item.kind === "recipe"
                                ? "serving"
                                : `${fmt(item.amount)} ${item.unit}`}
                            </span>
                          </p>
                          {item.kind === "recipe" && (
                            <p className="recipe-description">
                              {item.description ||
                                `${item.ingredients.length} ingredients · ${item.servings} servings`}
                            </p>
                          )}
                          <div className="card-actions">
                            <button
                              className="secondary"
                              onClick={() =>
                                setDialog({
                                  type: "entry",
                                  item,
                                  date,
                                  category: item.mealCategories[0],
                                })
                              }
                            >
                              <Plus size={16} />
                              Add to day
                            </button>
                            {item.kind === "recipe" && (
                              <button
                                className="icon-button"
                                aria-label={`Cook ${item.title}`}
                                onClick={() =>
                                  setDialog({ type: "cook", recipe: item })
                                }
                              >
                                <ChefHat size={19} />
                              </button>
                            )}
                            <button
                              className="icon-button"
                              aria-label={`Edit ${item.title}`}
                              onClick={() =>
                                setDialog(
                                  item.kind === "recipe"
                                    ? { type: "recipe", recipe: item }
                                    : { type: "food", item },
                                )
                              }
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Delete ${item.title}`}
                              onClick={() =>
                                setDialog({
                                  type: "delete",
                                  bucket: "library",
                                  id: item.id,
                                  title: item.title,
                                })
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
                {!data.library.length && (
                  <Empty title="Your collection starts here">
                    Import a recipe from ChatGPT, create your own, or add an
                    everyday food. Only the items you add will appear here.
                  </Empty>
                )}
                {data.library.length > 0 &&
                  !data.library.some(
                    (item) =>
                      (kind === "all" || item.kind === kind) &&
                      (category === "all" ||
                        item.mealCategories.includes(category as Category)) &&
                      item.title.toLowerCase().includes(search.toLowerCase()),
                  ) && (
                    <Empty title="No matches yet">
                      Try another search or a different meal category.
                    </Empty>
                  )}
              </>
            )}
            {tab === "groceries" && <Groceries open={setDialog} />}
            {tab === "history" && (
              <HistoryView
                onDay={(day) => {
                  setDate(day);
                  setTab("diary");
                }}
              />
            )}
          </main>
        )}
        <footer className="page-footer">
          <Leaf size={14} /> Made for your everyday.
        </footer>
      </div>
      {dialog?.type === "food" && (
        <FoodEditor item={dialog.item} onClose={close} />
      )}
      {dialog?.type === "recipe" && (
        <RecipeEditor recipe={dialog.recipe} onClose={close} />
      )}
      {dialog?.type === "import" && <ImportRecipe onClose={close} />}
      {dialog?.type === "entry" && (
        <EntryEditor
          entry={dialog.entry}
          initialItem={dialog.item}
          initialStatus={dialog.status}
          date={dialog.date}
          category={dialog.category}
          onClose={close}
        />
      )}
      {dialog?.type === "cook" && (
        <Cooking
          recipe={dialog.recipe}
          initialServings={dialog.servings}
          onClose={close}
        />
      )}
      {dialog?.type === "settings" && <SettingsDialog onClose={close} />}
      {dialog?.type === "delete" && (
        <DeleteDialog dialog={dialog} onClose={close} />
      )}
    </div>
  );
}
function DateControl({
  date,
  setDate,
}: {
  date: string;
  setDate: (date: string) => void;
}) {
  return (
    <div className="date-control">
      <div className="actions">
        <button
          className="icon-button"
          aria-label="Previous day"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft size={19} />
        </button>
        <label className="date-picker">
          <CalendarDays size={17} />
          <span>{dateLabel(date)}</span>
          <input
            aria-label="Selected day"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <button
          className="icon-button"
          aria-label="Next day"
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      {date !== today() && (
        <button className="text-button" onClick={() => setDate(today())}>
          Today
        </button>
      )}
    </div>
  );
}
function EntryRow({
  entry,
  open,
}: {
  entry: Entry;
  open: (dialog: Dialog) => void;
}) {
  return (
    <div className="entry">
      <div className="entry-details">
        <strong>{entry.item.title}</strong>
        <span>
          {fmt(entry.quantity)}{" "}
          {entry.item.kind === "recipe" ? "servings" : entry.item.unit} ·{" "}
          {fmt(calories(entry.item, entry.quantity))} kcal
        </span>
        <span className={`status-pill ${entry.status}`}>
          {entry.status === "eaten" && <Check size={12} />}
          {entry.status}
        </span>
      </div>
      <div className="entry-actions">
        {entry.status === "planned" && entry.date <= today() && (
          <button
            className="text-button"
            onClick={() =>
              open({
                type: "entry",
                entry: { ...entry, status: "eaten" },
                date: entry.date,
              })
            }
          >
            Mark eaten
          </button>
        )}
        {entry.item.kind === "recipe" && (
          <button
            className="icon-button"
            aria-label={`Cook ${entry.item.title}`}
            onClick={() =>
              open({
                type: "cook",
                recipe: entry.item as Recipe,
                servings: entry.quantity,
              })
            }
          >
            <ChefHat size={18} />
          </button>
        )}
        <button
          className="icon-button"
          aria-label={`Edit ${entry.item.title} entry`}
          onClick={() => open({ type: "entry", entry, date: entry.date })}
        >
          <Pencil size={16} />
        </button>
        <button
          className="icon-button danger"
          aria-label={`Remove ${entry.item.title} entry`}
          onClick={() =>
            open({
              type: "delete",
              bucket: "entries",
              id: entry.id,
              title: entry.item.title,
            })
          }
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
function Planner({
  date,
  setDate,
  open,
}: {
  date: string;
  setDate: (date: string) => void;
  open: (dialog: Dialog) => void;
}) {
  const { data } = useStore();
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const start = addDays(date, -((weekday + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE LOOK AHEAD</span>
          <h1>Make a plan. Enjoy the week.</h1>
          <p>Choose your meals now. Make the everyday easier.</p>
        </div>
        <button
          className="primary"
          onClick={() => open({ type: "entry", date, status: "planned" })}
        >
          <Plus size={18} />
          Plan a meal
        </button>
      </div>
      <div className="week-heading">
        <button
          className="icon-button"
          aria-label="Previous week"
          onClick={() => setDate(addDays(date, -7))}
        >
          <ChevronLeft />
        </button>
        <h2>
          {dateLabel(start, { month: "short", day: "numeric" })} –{" "}
          {dateLabel(days[6], {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <button
          className="icon-button"
          aria-label="Next week"
          onClick={() => setDate(addDays(date, 7))}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="week-strip">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setDate(day)}
            className={`${day === date ? "selected" : ""} ${day === today() ? "is-today" : ""}`}
          >
            <span>{dateLabel(day, { weekday: "short" })}</span>
            <strong>{dateLabel(day, { day: "numeric" })}</strong>
            <i
              className={
                data.entries.some((e) => e.date === day) ? "has-meal" : ""
              }
            />
          </button>
        ))}
      </div>
      <DateControl date={date} setDate={setDate} />
      <div className="planner-totals">
        <span>
          <strong>{fmt(totals(data.entries, date).planned)}</strong> kcal
          planned
        </span>
        <span>
          <strong>{fmt(totals(data.entries, date).eaten)}</strong> kcal eaten
        </span>
        <span>
          <strong>
            {targetOn(data.targets, date) === null
              ? "—"
              : fmt(targetOn(data.targets, date)!)}
          </strong>{" "}
          daily target
        </span>
      </div>
      <div className="planner-meals">
        {categories.map((c) => (
          <section className="meal-card" key={c}>
            <div className="meal-head">
              <h3>{c}</h3>
              <button
                className="icon-button"
                aria-label={`Plan ${c}`}
                onClick={() =>
                  open({ type: "entry", date, category: c, status: "planned" })
                }
              >
                <Plus size={20} />
              </button>
            </div>
            {data.entries
              .filter((e) => e.date === date && e.category === c)
              .map((e) => (
                <EntryRow key={e.id} entry={e} open={open} />
              ))}
            {!data.entries.some((e) => e.date === date && e.category === c) && (
              <button
                className="plan-empty"
                onClick={() =>
                  open({ type: "entry", date, category: c, status: "planned" })
                }
              >
                What's on the menu? <Plus size={16} />
              </button>
            )}
          </section>
        ))}
      </div>
      <p className="hint">
        Plans stay separate from your calorie history until you mark them as
        eaten.
      </p>
    </>
  );
}
function Groceries({ open }: { open: (dialog: Dialog) => void }) {
  const { data, save, busy } = useStore();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 6));
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const lists = [...data.groceries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const list = lists.find((l) => l.id === selected) ?? lists[0];
  async function generate(e: FormEvent) {
    e.preventDefault();
    if (to < from)
      return setError("The end date must be on or after the start date.");
    try {
      const result: GroceryList = {
        id: id(),
        from,
        to,
        createdAt: new Date().toISOString(),
        items: buildGroceries(data.entries, from, to),
      };
      await save("groceries", result);
      setSelected(result.id);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  async function update(items: Grocery[]) {
    if (list)
      try {
        await save("groceries", { ...list, items });
      } catch (e) {
        setError(String(e));
      }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    await update([
      ...list.items,
      {
        id: id(),
        name: String(fields.get("name")).trim(),
        quantity: Number(fields.get("quantity")),
        unit: fields.get("unit") as Unit,
        checked: false,
        excluded: false,
      },
    ]);
    form.reset();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FROM PLAN TO PANTRY</span>
          <h1>A good list goes a long way.</h1>
          <p>Everything you need for the meals you've planned.</p>
        </div>
        <ShoppingBasket className="heading-icon" size={40} strokeWidth={1.2} />
      </div>
      <form className="grocery-generator" onSubmit={generate}>
        <label>
          From
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          <Plus size={18} />
          Generate list
        </button>
      </form>
      <p className="hint">
        Includes planned meals only. Matching ingredient names and compatible
        units are combined. Lists are saved snapshots; generate a new one after
        changing your plan.
      </p>
      <ErrorText error={error} />
      {list ? (
        <section className="grocery-panel">
          <div className="section-heading">
            <div>
              <h2>Your shopping list</h2>
              <p>
                {list.items.filter((i) => i.checked && !i.excluded).length} of{" "}
                {list.items.filter((i) => !i.excluded).length} items picked up
              </p>
            </div>
            <button
              className="icon-button danger"
              aria-label="Delete grocery list"
              onClick={() =>
                open({
                  type: "delete",
                  bucket: "groceries",
                  id: list.id,
                  title: "this grocery list",
                })
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
          <label>
            Saved lists
            <select
              value={list.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {lists.map((l) => (
                <option value={l.id} key={l.id}>
                  {dateLabel(l.from, { month: "short", day: "numeric" })} –{" "}
                  {dateLabel(l.to, { month: "short", day: "numeric" })} ·{" "}
                  {new Date(l.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <progress
            max={list.items.filter((i) => !i.excluded).length || 1}
            value={list.items.filter((i) => i.checked && !i.excluded).length}
          />
          {!list.items.length && (
            <Empty title="Nothing on the list yet">
              Add meals to your plan and generate a new list, or add an item
              below.
            </Empty>
          )}
          {list.items
            .filter((i) => !i.excluded)
            .map((item) => (
              <div
                className={`grocery-row ${item.checked ? "done" : ""}`}
                key={item.id}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={busy}
                    onChange={() =>
                      update(
                        list.items.map((i) =>
                          i.id === item.id ? { ...i, checked: !i.checked } : i,
                        ),
                      )
                    }
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {fmt(item.quantity)} {item.unit}
                    </small>
                  </span>
                </label>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    update(
                      list.items.map((i) =>
                        i.id === item.id ? { ...i, excluded: true } : i,
                      ),
                    )
                  }
                >
                  Have it
                </button>
              </div>
            ))}
          {list.items.some((i) => i.excluded) && (
            <details>
              <summary>
                Already at home ({list.items.filter((i) => i.excluded).length})
              </summary>
              {list.items
                .filter((i) => i.excluded)
                .map((item) => (
                  <div className="grocery-row" key={item.id}>
                    <span>
                      {item.name} · {fmt(item.quantity)} {item.unit}
                    </span>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        update(
                          list.items.map((i) =>
                            i.id === item.id
                              ? { ...i, excluded: false, checked: false }
                              : i,
                          ),
                        )
                      }
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </details>
          )}
          <form className="manual-grocery" onSubmit={add}>
            <h3>Anything else?</h3>
            <label>
              Item
              <input
                name="name"
                required
                maxLength={200}
                placeholder="Add something to your list"
              />
            </label>
            <div className="form-row">
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="0.001"
                  max="1000000"
                  step="any"
                  defaultValue="1"
                  required
                />
              </label>
              <label>
                Unit
                <select name="unit" defaultValue="piece">
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
              <button className="secondary" disabled={busy}>
                <Plus size={18} />
                Add item
              </button>
            </div>
          </form>
        </section>
      ) : (
        <Empty title="Your next shop starts here">
          Choose the days you're shopping for, then generate a list from your
          meal plan.
        </Empty>
      )}
    </>
  );
}
function HistoryView({ onDay }: { onDay: (day: string) => void }) {
  const { data } = useStore();
  const [range, setRange] = useState(7);
  const [end, setEnd] = useState(today());
  const chart = Array.from({ length: range }, (_, i) => {
    const date = addDays(end, i - range + 1);
    const logged = data.entries.some(
      (e) => e.date === date && e.status === "eaten",
    );
    return {
      date,
      label: dateLabel(date, { month: "short", day: "numeric" }),
      consumed: logged ? Math.round(totals(data.entries, date).eaten) : null,
      target: targetOn(data.targets, date),
    };
  });
  const recorded = chart.filter((d) => d.consumed !== null);
  const total = recorded.reduce((sum, d) => sum + d.consumed!, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>A little perspective.</h1>
          <p>Look back at your days and see your progress.</p>
        </div>
        <div className="tabs">
          <button
            className={range === 7 ? "selected" : ""}
            onClick={() => setRange(7)}
          >
            7 days
          </button>
          <button
            className={range === 30 ? "selected" : ""}
            onClick={() => setRange(30)}
          >
            30 days
          </button>
        </div>
      </div>
      <div className="history-controls">
        <button
          className="icon-button"
          aria-label="Earlier period"
          onClick={() => setEnd(addDays(end, -range))}
        >
          <ChevronLeft />
        </button>
        <label>
          Period ending
          <input
            type="date"
            value={end}
            max={today()}
            onChange={(e) => e.target.value && setEnd(e.target.value)}
          />
        </label>
        <button
          className="icon-button"
          aria-label="Later period"
          disabled={end >= today()}
          onClick={() =>
            setEnd(
              addDays(end, range) > today() ? today() : addDays(end, range),
            )
          }
        >
          <ChevronRight />
        </button>
      </div>
      <div className="history-stats">
        <section>
          <span>Average on logged days</span>
          <strong>
            {recorded.length ? fmt(total / recorded.length) : "—"}
            <small> kcal</small>
          </strong>
        </section>
        <section>
          <span>Days with food logged</span>
          <strong>
            {recorded.length}
            <small> / {range}</small>
          </strong>
        </section>
        <section>
          <span>Total consumed</span>
          <strong>
            {fmt(total)}
            <small> kcal</small>
          </strong>
        </section>
      </div>
      <section className="chart-panel">
        <div className="section-heading">
          <h2>Calories over time</h2>
          <span>
            <i className="legend-dot eaten-dot" />
            Eaten <i className="legend-dot target-dot" />
            Target
          </span>
        </div>
        <div
          className="history-chart"
          role="img"
          aria-label="Daily calorie chart. Exact values are in the table below."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chart}
              margin={{ top: 15, right: 5, bottom: 5, left: -15 }}
            >
              <CartesianGrid vertical={false} stroke="#e6e8df" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value, name) => [
                  `${value} kcal`,
                  name === "consumed" ? "Eaten" : "Target",
                ]}
              />
              <Area
                type="monotone"
                dataKey="consumed"
                fill="#e1eadc"
                stroke="none"
              />
              <Bar
                dataKey="consumed"
                fill="#477460"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Line
                dataKey="target"
                stroke="#c58d48"
                dot={false}
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="hint">
          Blank days mean no food was logged. Planned meals are excluded.
          Averages use logged days only.
        </p>
      </section>
      <section className="history-table">
        <h2>Day by day</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Eaten</th>
              <th>Target</th>
              <th>
                <span className="sr-only">Open day</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...chart].reverse().map((day) => (
              <tr key={day.date}>
                <td>
                  {dateLabel(day.date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td>
                  {day.consumed === null
                    ? "Not logged"
                    : `${fmt(day.consumed)} kcal`}
                </td>
                <td>{day.target === null ? "—" : fmt(day.target)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${day.date}`}
                    onClick={() => onDay(day.date)}
                  >
                    <ArrowRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { data, user, demo, save, logout, busy } = useStore();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const date = String(form.get("date"));
      await save("targets", {
        id: date,
        date,
        calories: Number(form.get("calories")),
      });
      setSaved(true);
    } catch (e) {
      setError(String(e));
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { schemaVersion: 1, exportedAt: new Date().toISOString(), ...data },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `plateful-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Modal title="Your preferences" onClose={onClose}>
      <div className="form-stack">
        <div className="profile">
          <CircleUserRound size={32} />
          <div>
            <strong>{demo ? "Preview account" : user?.displayName}</strong>
            <small>
              {demo ? "Temporary data · not synchronized" : user?.email}
            </small>
          </div>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <h3>Daily calorie target</h3>
          <div className="form-row">
            <label>
              Target (kcal)
              <input
                name="calories"
                required
                type="number"
                min="1"
                max="100000"
                step="1"
                defaultValue={targetOn(data.targets, today()) ?? ""}
              />
            </label>
            <label>
              Applies from
              <input
                name="date"
                required
                type="date"
                defaultValue={today()}
                min={today()}
              />
            </label>
          </div>
          <p className="hint">
            Changes apply from the date you choose. Earlier targets stay in your
            history.
          </p>
          <ErrorText error={error} />
          <button className="primary" disabled={busy}>
            {saved ? (
              <>
                <Check size={17} />
                Target saved
              </>
            ) : (
              "Save target"
            )}
          </button>
        </form>
        <hr />
        <h3>Your data</h3>
        <p className="hint">
          Your account keeps a private library, diary, plan, and grocery lists.
          Download a copy whenever you like.
        </p>
        <button className="secondary" onClick={exportData}>
          <Download size={17} />
          Export my data
        </button>
        <button
          className="secondary"
          onClick={async () => {
            await logout();
            onClose();
          }}
        >
          <LogOut size={17} />
          {demo ? "Leave preview" : "Sign out"}
        </button>
      </div>
    </Modal>
  );
}
function DeleteDialog({
  dialog,
  onClose,
}: {
  dialog: Extract<Dialog, { type: "delete" }>;
  onClose: () => void;
}) {
  const { remove, busy } = useStore();
  const [error, setError] = useState("");
  return (
    <Modal title="Remove item?" onClose={onClose}>
      <p>Remove {dialog.title}?</p>
      {dialog.bucket === "library" && (
        <p className="hint">
          Existing diary entries and meal plans keep their saved copy.
        </p>
      )}
      <ErrorText error={error} />
      <div className="actions">
        <button className="secondary" onClick={onClose}>
          Keep it
        </button>
        <button
          className="primary destructive"
          disabled={busy}
          onClick={async () => {
            try {
              await remove(dialog.bucket, dialog.id);
              onClose();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Remove
        </button>
      </div>
    </Modal>
  );
}
