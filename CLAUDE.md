# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the Expo mobile app (iOS/Android/web)
npm start          # or: npm run ios / npm run android / npm run web

# Start the local AI server (required for all AI features)
npm run ai-server  # runs server/index.js on port 3001

# Run test suites (all are plain Node.js scripts — no test runner needed)
node scripts/run-ai-filing-regression.js
node scripts/run-todo-utils-tests.js
node scripts/run-capture-routing-server-tests.js   # requires ai-server running
node scripts/run-todo-generation-sanitize-tests.js
node scripts/run-todo-generation-invariant-tests.js
node scripts/run-capture-jobs-tests.js
```

TypeScript is compiled by Expo/Babel at build time — there is no standalone `tsc` build step, but `npx tsc --noEmit` can be used for type-checking.

## Architecture overview

### App shell (`App.tsx`)

The entire app is a single React Native component (`App.tsx`, ~2500 lines). Navigation between the 14 screens is managed with a `currentScreen: Screen` state string — there is **no React Navigation stack in use for screen transitions**; screens are rendered conditionally by `renderXxxScreen()` helpers. React Navigation's `NavigationContainer`/`createNativeStackNavigator` is imported but the primary navigation mechanism is manual state. Swipe-back is implemented with a `PanResponder` that calls `goBack()`.

All mutable app data lives in `useDataStore` (Zustand, `utils/stores/dataStore.ts`). Each data domain has a paired save pattern: `saveFoo(updated)` calls the persistence layer then updates Zustand.

### Persistence (`utils/persistence.ts`)

All data is stored as JSON files in Expo's `documentDirectory` via `expo-file-system`. Files:
- `antinetCards.json` — cards
- `secondMindInboxCaptures.json` — inbox captures
- `secondMindTodos.json` — todos
- `secondMindCaptureJobs.json` — capture pipeline jobs
- `antinetCustomCategories.json`, `antinetCategoryOverrides.json`, `antinetDeletedDefaultCategories.json` — category customization layers
- `antinetSettings.json` — app settings

`loadAllData()` + `migrateDataIfNeeded()` are called once on mount. Backup/restore is also handled here using `expo-sharing`.

### Category system (`utils/antinet.ts`, `data/antinetCategories.ts`)

Categories use a three-layer merge: default categories (hardcoded in `data/antinetCategories.ts`) + user overrides (`categoryOverrides`) + custom categories (`customCategories`) - deleted defaults (`deletedDefaultCategoryIds`). `buildCategoryTree()` produces this merged tree. Categories have range-based addresses (e.g. `1000-1999`, `1100`, `1101`). Cards are addressed within leaf categories (e.g. `1101/1`).

### AI pipeline — capture routing

When a quick capture is submitted, it enters a multi-stage async pipeline coordinated by `hooks/useCaptureRouting.ts` and `hooks/useCaptureJobs.ts`:

1. **Classify** (`/api/classify-capture`) — AI decides `card` vs `todo` with a confidence band. If confidence is low or the capture is ambiguous, the job enters `awaiting_clarification` and a banner prompts the user.
2. **Enrich** (`/api/enrich-capture`, card route) — AI structures the raw text into title/content/tags/source/status fields (`CaptureStructuringResult`).
3. **File** (`/api/suggest-card-filing`) — Two-stage: master range selection then leaf category/card address suggestion (`CardFilingSuggestion`).
4. **Generate todos** (`/api/generate-todos`, todo route) — AI produces a hierarchical `TodoGenerationDraft[]`; local heuristic hints (`utils/heuristicTodoHints.ts`) seed the prompt.

Job state is persisted in `CaptureJob` objects (status: `pending` → `classifying` → `awaiting_clarification` | `enriching` | `generating_todos` → `completed` | `failed`). Active jobs are tracked in `hooks/useCaptureJobs.ts`.

Clarification rounds: the pipeline can pause at `awaiting_clarification` up to `MAX_CAPTURE_CLARIFICATION_ROUNDS` times; the user answers via `CaptureClarificationModal`. Answers are appended to `CaptureJob.clarificationAnswers` and the job resumes.

### AI server (`server/index.js`)

Plain Node.js HTTP server (no framework). Uses xAI Grok by default (`grok-4-1-fast`), OpenAI-compatible. All AI calls use structured JSON output (`response_format: json_schema`). The server implements in-flight deduplication and an LRU cache for each endpoint (limit: 48 entries). Endpoint handlers for capture routing are in `server/captureRouting.js`; todo sanitization in `server/todoGenerationSanitize.js`.

Configure via env vars in `server/.env`:
```
AI_PROVIDER=xai           # or openai
XAI_API_KEY=...
AI_MODEL=grok-4-1-fast    # optional override — used for enrich + generate-todos
AI_CLASSIFY_MODEL=grok-3-mini-fast  # optional — lighter model just for classify step (default: AI_MODEL)
PORT=3001
```

The app's AI endpoint URL is user-configurable in Settings (default: `http://localhost:3001`).

### Key utility modules

| File | Purpose |
|---|---|
| `utils/antinet.ts` | Address validation, category tree ops, card sorting, normalization |
| `utils/aiFiling.ts` | Filing suggestion payload builders, form field hydration |
| `utils/aiCataloguing.ts` | Capture structuring helpers, structuring-to-capture restraint |
| `utils/captureJobs.ts` | Job state machines, view builders for UI, classification finalization |
| `utils/todoTree.ts` | Flat todo list operations (indent/outdent/reorder/toggle) |
| `utils/todoAppend.ts` | Merging AI-generated todos into the existing list |
| `utils/todoGenerationSanitize.ts` | Post-processing/invariant enforcement on AI todo output |
| `utils/heuristicTodoHints.ts` | Local heuristic pre-pass before calling AI for todo generation |
| `utils/todoParsing.ts` | Local parsing of captures into todo drafts (no AI) |

### Hooks

- `hooks/useAiFiling.ts` — manages filing suggestion lifecycle (request, cancel, retry, alternatives)
- `hooks/useCaptureRouting.ts` — orchestrates the full capture pipeline (classify → enrich/generate → file)
- `hooks/useCaptureJobs.ts` — job queue state, active job tracking
- `hooks/useCaptureStructuring.ts` — standalone structuring + filing for inbox "file with AI" flow
