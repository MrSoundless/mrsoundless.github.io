# Plateful

A phone-first recipe library, calorie diary, meal planner, cooking guide and grocery list. React + TypeScript + Vite; Firebase Authentication and Cloud Firestore provide Google sign-in and private synchronization. Hosted at /calorie-tracker/ on GitHub Pages.

## Local development

Requires Node.js 22.12+ (Node 24 recommended).

    cd calorie-tracker
    npm ci
    npm run dev

Open the printed localhost URL with /calorie-tracker/ appended. Without Firebase, the landing page offers an empty in-memory preview. Preview changes disappear on reload. No food catalogue is installed.

    npm test
    npm run build
    npx playwright install chromium
    npm run test:e2e

## Connect Firebase — one-time setup

1. Open https://console.firebase.google.com/ and create a project, for example Plateful. Analytics is not needed.
2. In **Project settings → General**, add a **Web app** (the </> icon). Firebase Hosting is not needed. Copy its apiKey, authDomain, projectId, and appId into **public/firebase-config.json**. Keep the supplied authDomain (usually YOUR_PROJECT.firebaseapp.com).
3. Open **Security → Authentication → Get started → Sign-in method**, enable **Google**, choose the support email, and save.
4. In **Authentication → Settings → Authorized domains**, add **mrsoundless.github.io**. For local testing add **localhost** and **127.0.0.1** if absent. Use hostnames without paths or https://.
5. Open **Database & Storage → Firestore Database → Create database**. Choose a region appropriate for your users (Europe is suitable here), and start in **production mode**.
6. In Firestore's **Rules** tab, replace the contents with the complete **firestore.rules** file from this folder. Click **Publish**. Do not use open/test-mode rules: the included rules restrict each collection to its signed-in owner.
7. Rebuild/redeploy after saving the configuration. Sign in using Google. Add a food on your phone, then sign in with the same account on your computer and verify it appears. A different Google account should see an empty library.

The web configuration is intentionally public. Never put a service-account private key, Admin SDK credentials, or OAuth client secret in this repository. Firestore rules protect account data. No privileged server SDK, external food database, AI API, or analytics is used.

Official documentation: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [owner-based rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

## GitHub Pages deployment

The repository's .github/workflows/pages.yml builds and tests Plateful, builds the existing site with GitHub's Jekyll builder, then overlays the compiled app at /calorie-tracker/. Existing app paths are retained.

1. Commit and push the changes to **master**.
2. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy website → Run workflow** if deployment has not started.
4. Open https://mrsoundless.github.io/calorie-tracker/ after deployment.

Optionally set the repository variable **FIREBASE_WEB_CONFIG** to the same JSON object. It overrides the blank checked-in config during the workflow build.

The Firebase project and Pages source require account-side setup. Real Google sign-in and cross-device sync cannot work until Firebase is configured. The local build does not create Firebase resources, publish rules, push Git changes or change Pages settings.

## Behavior

- Private collections: users/{uid}/library, entries, targets, groceries. New accounts start empty.
- Entries keep a snapshot of the selected recipe/food. Library edits or deletion do not change existing plans or historical calories.
- One meal category per diary entry; several allowed per library item.
- Recipe portions are servings. Foods use their defined amount/unit (for example 60 kcal per 100 g or 90 kcal per 1 piece).
- Future entries are planned. Plans only enter consumed-calorie history after you mark them eaten.
- Targets apply from the selected date (today or later), preserving earlier targets. Days before the first target have no target.
- History covers 7 or 30 days. Averages use logged days only; missing days are not zero intake.
- Groceries include only planned meals in the inclusive date range, scaled to the chosen portions. Matching normalized names combine, kg converts to g, and l converts to ml. Pieces/tsp/tbsp stay separate; no density or piece-weight conversion is guessed.
- Grocery lists are saved snapshots. After plan changes, generate a new list. Existing lists/checkmarks remain. Mark items bought or already owned, restore them or add manual items. Simultaneous edits to the same list use the last saved version.
- Cooking timers use wall-clock deadlines and remain visible across steps. Keep cooking mode open; closing it or reloading discards timers. No background notification or sound is promised.
- Internet is required to save account data. Offline persistence is not enabled. A write interrupted by connection loss can remain pending until the server acknowledges it.
- Settings provides JSON data export. Full-account restore is not implemented; recipe import is separate.
- Calories come from user-entered or imported estimates. No automatic recipe suggestions or calorie advice.

## Recipe import

In **Library → Import recipe → Get the ChatGPT prompt**, copy the prompt, add your recipe request in ChatGPT, and paste the JSON result. Review or edit before saving. Schema version 1 matches the agreed format. Invalid quantities, servings, units and timers are rejected. Markdown JSON fences are accepted. The canonical schema/prompt are in src/domain.ts.

## Verification limits

Unit and browser tests cover the in-memory preview, which uses the same UI and domain logic as signed-in mode. A configured Firebase project is required to verify real Google OAuth, published rules and cross-device synchronization.

## Preparation phase

Recipes can include a preparationSteps array, with the same instruction and optional timerSeconds fields as cooking steps. Cooking mode follows Ingredients → Preparation → Cooking. The editor and ChatGPT prompt support both phases. Older schemaVersion 1 recipes remain valid without this optional field: their instructions are preserved, and the app explains how to add preparation steps. Ingredient notes are not converted automatically because they may contain size or calorie assumptions rather than actions.

The supplied omelette is available in examples/omelette-with-preparation.json, with explicit preparation instructions. Its existing calorie estimate is retained, and cookTimeMinutes matches the original timers (11 minutes).

