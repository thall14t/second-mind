# Session Summary: Antinet / Second Mind Expo RN App

**Date of Last Session**: 2026-06-18  
**Current Branch**: `feature/phase-a-routing` (based on `v0.10-stable-todos`)  
**Stable Anchor Tag**: `v0.10-stable-todos` (Phase 1 todos complete; prior: `v0.9-stable-ui`)  
**Project Path**: `C:\Users\thoma\Antinet`  
**Git Remote**: `https://github.com/thall14t/second-mind.git`  
**App Name**: Second Mind (Expo ~54, React Native 0.81, React 19)  
**Purpose of this file**: Detailed snapshot so future / suture sessions can pick up exactly where we left off without re-reading the entire history. This includes architecture, decisions, state of code, Git workflow, and the current planning status for Phase 1.

---

## Directive for Future / Suture Sessions

**This file is the authoritative continuity document. Treating it as optional will cause repeated context loss and wasted effort.**

### Mandatory Rules for Every New Session:

1. **Read this entire file first** before touching any code, running commands, or making architectural decisions.
2. **Keep this file updated**:
   - Update it at the end of each major piece of work.
   - Update it before switching branches, starting a new focus area, or ending the session.
   - Always refresh the following sections when the state changes:
     - Current Branch / Stable Anchor Tag
     - Current Stable State
     - Git Anchors
     - Planned / In-Progress Work
     - Open Questions & Next Steps
3. **Proceed as follows**:
   - Start on `master` unless you have a specific reason not to.
   - Use `git diff <stable-tag>` to understand what has changed since the last known-good state.
   - Use the "How to Continue in a Future Session" section (below) as your operational checklist.
   - Create a new branch for any non-trivial work (`git checkout -b feature/xxx` or `git checkout -b experiment/xxx`).
   - When you reach another stable milestone, create a new annotated tag and update this document.
4. **Preserve history**:
   - Commit updates to `session_summary.md` together with your code changes.
   - Do not delete or overwrite this file. Append or refine sections as the project evolves.
5. **When the plan changes**:
   - Clearly document the new direction in this file under "Planned Work" or a new section.
   - Note why the previous direction was adjusted (lessons learned, user feedback, technical blockers).

Failure to follow these rules has historically led to duplicated effort, re-implementing reverted features, and losing context about why certain decisions were made.

---

## 🚀 Start Tweaking Here: Tentative Phase 1 Plan

**This is the active, editable starting point for Phase 1 work.**

When you open a new session, scroll to (or search for) this section first. Tweak, expand, or refine the plan directly in this file before implementing anything. Then update the rest of the summary as you go.

### High-Level Goal
Make Quick Capture a true catch-all that can produce structured, nestable todos, and provide a first-class Todo list. This is the focused slice of Phase 1 we agreed to tackle next.

### Current Baseline (pre-Phase 1)
- Clean state after full revert of previous Phase 1 attempts.
- No Todo types, no storage, no UI, no screens.
- QuickCapture is always generic (title + multiline content) → saves as plain `InboxCapture`.
- Inbox only supports filing as cards ("File This" or "File With AI").
- Capture structuring is currently card-oriented only.
- Navigation: Hybrid React Navigation Stack + custom swipe.
- Home only shows Cards + Inbox stats.

### Scope for This Slice
- Focus strictly on **todos** (defer calendar events unless explicitly added).
- Support **nesting** from day one (parent + children via `parentId`).
- Quick Capture must **recognize and generate** todos (manual selection + parsing/generation logic).
- Basic end-to-end: capture → generate structured todos → store → view/edit in list → integrate with Inbox and Home.
- Use existing patterns (Zustand, JSON persistence, render functions, navigateTo, etc.).
- Keep all card functionality untouched where possible.
- Follow the "small chunks" rule: implement one layer at a time with verification.

### Key Decisions / Scope
- Add type awareness to Quick Capture (segmented control: "Card Idea" | "Todo List").
- Generation logic: local parsing (newlines, `- `, `* `, numbers) + optional AI structuring.
- When "Todo List" mode: parse/generate immediately on save (or after AI).
- Todos stored as first-class data (separate from captures).
- Inbox gets "Turn into Todo" action using the same generation logic.
- Home gets todo count + navigation.
- AI assistant context will eventually include todos (later in broader Phase 1).

### Proposed Data Model
```ts
export interface Todo {
  id: string;
  title: string;
  content?: string;
  completed: boolean;
  parentId?: string;           // null/undefined = top-level parent
  createdAt: string;
  relatedAddresses?: string[]; // optional links to cards
}

// Optional extension for captures
export interface InboxCapture {
  id: string;
  title: string;
  content: string;
  sourceText?: string;
  createdAt: string;
  intendedType?: 'card' | 'todo';   // for catch-all behavior
}
```

### Major Areas to Implement (in recommended small-chunk order)
1. **Data Layer**  
   - Add `Todo` interface to `types.ts`.  
   - Extend `dataStore.ts` (todos array + setters + initial state).  
   - Update `persistence.ts` (TODOS_FILE, save/load functions, include in loadAllData + createBackupData + restore).  
   - Update any backup/restore paths in App.tsx.

2. **Quick Capture Todo Mode**  
   - Add segmented type picker to `QuickCaptureScreen.tsx`.  
   - Update props and state handling in App.tsx (`captureType`).  
   - In `saveQuickCaptureToInbox`: branch on type.  
   - Basic parser: split content into parent + sub-todos.  
   - Create `Todo[]` and persist (bypass generic inbox for direct todo saves, or keep as typed capture).

3. **Todo Storage Wiring**  
   - Full integration in `loadData`, save wrappers, and state sync in App.tsx.  
   - Ensure `createBackupData` and restore handle todos.

4. **Basic TodoListScreen**  
   - New component `TodoListScreen.tsx` (or restore cleaned version).  
   - Display parents + indented children.  
   - Toggle complete, delete, basic "+ Sub".  
   - Empty state messaging.  
   - Wire props from store (todos, toggleTodo, deleteTodo, addSubTodo, onBack).

5. **Navigation & Home Integration**  
   - Add `todoList` screen to `MainStack` in App.tsx.  
   - Update `renderHomeScreen` with `todoCount` + "View Todos" button + `onOpenTodos`.  
   - `navigateTo('todoList')` wiring.  
   - Update `getLiveSwipeUnderlayDescriptor` and `goBack` if needed.

6. **Inbox Integration**  
   - Add "Turn into Todo" button in `InboxScreen.tsx`.  
   - New handler in App.tsx (parse capture → create Todo[] → delete capture).  
   - Optional: support both manual and AI-assisted conversion.

7. **AI / Structuring Enhancement**  
   - Extend `CaptureStructuringResult` (or add todo-specific output).  
   - Update `useCaptureStructuring` and `aiCaptureStructuring.ts` for todo list generation.  
   - Handle in `fileInboxCaptureWithAi` when type is todo.  
   - Update server-side logic if structured output needs adjustment.  
   - "File With AI" on a capture should be able to produce a todo list.

8. **Polish & Cross-Cutting**  
   - Add todos to full backup/restore.  
   - Ensure proper ScrollView + KeyboardAvoidingView on new forms.  
   - Disable swipe gesture on todo-related screens if needed.  
   - Nesting refinements (add sub with user input, not just hardcoded title).  
   - Update any docs or regression scripts.  
   - Basic testing/verification of flows.

### Incremental Philosophy
- Small, safe chunks only. Verify with `tsc --noEmit`, manual testing, and `git diff` after each piece.
- Always work from the stable anchor (`v0.9-stable-ui` tag) as the "before" baseline.
- Create a feature branch for this work (e.g., `feature/phase1-todos`).
- When a chunk is done and stable, commit + consider a new tag.
- Update **this section** of session_summary.md as you tweak or complete parts.

### Open Questions — Resolved for This Slice
- **Type selector**: Manual segmented control ("Card Idea" | "Todo List") in Quick Capture.
- **Nesting**: Parent + children via `parentId` from day one; drag-and-drop deferred.
- **AI role**: Local parsing on save; AI structuring via "File With AI" / inbox conversion (chunk 7).
- **Calendar events**: Deferred — todos only in this slice.
- **Parsing heuristics**: Newlines, `- `, `* `, numbered lists; checkboxes/priorities later.
- **Data model**: As proposed below — no changes needed.

### Implementation Progress
- [x] **Chunk 1 — Data Layer** (2026-06-18): `Todo` type, `intendedType` on `InboxCapture`, Zustand `todos` state, `secondMindTodos.json` persistence, backup/restore wiring in `App.tsx`.
- [x] **Chunk 2 — Quick Capture Todo Mode**: Segmented "Card Idea" | "Todo List" picker, `parseTodosFromCapture` in `utils/todoParsing.ts`, direct `saveTodos` on todo save.
- [x] **Chunk 3 — Todo Storage Wiring**: Complete (load/save/backup/restore all wired).
- [x] **Chunk 4 — Basic TodoListScreen**: Parents + indented children, toggle complete, delete, hardcoded "+ Sub".
- [x] **Chunk 5 — Navigation & Home Integration**: `todoList` screen, Home stats + "View Todos" tile, swipe-back support.
- [x] **Chunk 6 — Inbox Integration** (2026-06-18): "Turn into Todo" button, `turnInboxCaptureIntoTodos` in `App.tsx`, `intendedType` pill on inbox captures.
- [ ] Chunk 7 — AI / Structuring Enhancement (superseded by Phase A unified capture routing)
- [x] **Chunk 8 — Polish & Cross-Cutting** (2026-06-18): inline edit, collapse persistence, auto-save, tree guides, long-press delete, Home stat pills.

**Phase 1 complete** — tagged `v0.10-stable-todos` (commit `ce99607`).

**Next up**: **Phase A — Unified AI Capture Routing** on `feature/phase-a-routing` (A1 contract doc → types/jobs → server APIs → client).

---

## 1. Project Overview

This is a mobile app (Expo/React Native) implementing a digital version of an **Antinet** (Zettelkasten-style personal knowledge management system) called **Second Mind**.

Core concepts:
- **Cards**: Atomic notes with addresses (e.g., 0102a), titles, content, status (Seed/Growing/Evergreen), tags, related cards, sources.
- **Categories**: Hierarchical Antinet structure (master boxes, categories, sub-ranges).
- **Inbox / Quick Capture**: Catch-all for rough thoughts before filing.
- **AI Features**: Filing suggestions, capture structuring (title/body/source split), "Ask My Cards".
- **Hybrid Navigation**: React Navigation Stack + custom swipe gestures (PanResponder + Animated layers for underlay/foreground "drawer" feel).
- **State**: Zustand store.
- **Persistence**: JSON files via `expo-file-system/legacy` (no SQLite yet).
- **AI Backend**: Separate Node server (can run locally or on Render.com).

The app is **not yet** at App Store / Play Store readiness. Focus has been on internal architecture, data model, and AI integration.

**Important**: We deliberately avoided EAS builds and full production deploys until the UI and core flows are stable (per user instruction).

---

## 2. Current Stable State (as of 2026-06-18)

We are on a **clean pre-Phase 1 baseline** after multiple reverts and UI stabilization work by the user.

### Confirmed Features (Working / Present)
- Basic card creation, editing, listing, viewing, threading.
- Category management (default Antinet + custom).
- Quick Capture (title + multiline content) → saves to Inbox as generic `InboxCapture`.
- Inbox: list of captures with "File This", "File With AI", Delete.
- Filing with AI (uses server for suggestions).
- "Ask My Cards" with AI.
- Custom swipe navigation (horizontal back gesture) layered over RN Stack.Navigator.
- Home screen with hero, stats (Cards + Inbox only), primary actions, utility grid.
- Thinking / loading states for AI operations.
- Backup / restore / share functionality (JSON).
- ErrorBoundary.
- Theming (darkMode support).
- AI server (local or Render) for filing, structuring, ask-cards.

### Phase 1 In Progress (feature/phase1-todos)
- **Done**: Data layer, Quick Capture todo mode + parser, TodoListScreen, Home todo count/navigation.
- **Still absent**: Inbox "Turn into Todo", AI todo structuring, polish (sub-task input prompt, etc.).

### Explicitly Absent (Not Yet Implemented)
- **No Inbox todo conversion** ("Turn into Todo" button/handler).
- **No AI todo structuring** ("File With AI" → todo list).
- **No CalendarEvent**.
- **No typed captures** (`InboxCapture` has no `type` field).
- No segmented type picker in QuickCapture.
- No `TodoListScreen`, `EventListScreen`.
- No "Turn into Todo/Event" buttons in Inbox.
- No todo/event counts or buttons on Home.
- No nested todo logic.
- `dataStore.ts`, `persistence.ts`, `types.ts`, `App.tsx`, `HomeScreen.tsx`, `QuickCaptureScreen.tsx`, `InboxScreen.tsx` are all stripped of Phase 1 additions.

### Git Anchors (Critical for Recovery)
- **Tag**: `v0.9-stable-ui` — This is the permanent anchor for the stable pre-Phase 1 + user-fixed UI state.
  - Commit: `b61f552` ("Stable baseline - pre-Phase 1 (core cards/inbox + AI + hybrid nav). UI stabilized after manual fixes.")
- **Branch**: `stable/pre-phase1-ui` — Working branch based on the stable tag (for safe experimentation).
- **master**: Primary development branch going forward.
- **How to use**:
  ```bash
  git checkout master                    # normal development
  git diff v0.9-stable-ui                # compare to stable anchor
  git checkout v0.9-stable-ui            # jump back to known-good state
  git tag -a v1.0-stable-ui -m "..."     # create new anchor when ready
  ```

**Always** commit to `master` for new work. Use the tag/branch as the rollback/comparison point.

---

## 3. Architecture (Current Stable)

### Navigation (Hybrid — Source of Complexity)
- `NavigationContainer` + `createNativeStackNavigator` (MainStack).
- All main screens registered as children of Stack.Screen (using render functions for closure over state).
- **Custom swipe layer** on top:
  - `Animated.View` (swipeLayer) with `PanResponder`.
  - Underlay (peek during swipe) + Foreground.
  - `renderScrollShell` (FlatList wrapper) used for some underlays and older screens.
  - `currentScreen` state still used for swipe descriptors and some legacy logic.
- Screens often use `navigateTo(screen)` which does both `setCurrentScreen` + `navigationRef.current.navigate(screen)`.
- Special handling for modals/overlays (selectedCard, cardThread, thinking) outside the pure stack in `renderForegroundContent`.

**Gotcha**: The hybrid nature (custom gestures + RN Nav) has caused repeated issues with re-renders, navigator registration errors ("another navigator already registered"), keyboard behavior, and scroll.

### State Management
- **Zustand** (`utils/stores/dataStore.ts`):
  - Core data: `cards`, `inboxCaptures`, `customCategories`, `categoryOverrides`, `deletedDefaultCategoryIds`, `settings`.
  - UI state: `searchQuery`, `expandedCategories`, `isLoadingData`, `captureTitle`, `captureContent`, `askCardsQuestion`, etc.
  - No `todos`, no `captureType`, no `events` in current baseline.

### Persistence (`utils/persistence.ts`)
- Pure JSON files in `FileSystem.documentDirectory`.
- Files: `antinetCards.json`, `secondMindInboxCaptures.json`, category files, settings, etc.
- `loadAllData()`, `createBackupData()`, `migrateDataIfNeeded()` (version 1).
- Note in code about future expo-sqlite for relational data (todos/events).

### AI Layer
- Client hooks: `useAiFiling.ts`, `useCaptureStructuring.ts`.
- Utils: `aiCataloguing.ts`, `aiCaptureStructuring.ts`, `aiFiling.ts`, `aiRequests.ts`.
- Server: `server/index.js` (proxies to xAI/Grok with structured outputs).
- Render deployment ready (`render.yaml`, `RENDER_DEPLOY.md`).
- Current structuring is card-focused (title, body, source).

### Key Screens & Components (Current)
- `HomeScreen.tsx` — Hero card, stats (only Cards/Inbox), primary buttons, utility grid.
- `QuickCaptureScreen.tsx` — Simple title + multiline. Always generic.
- `InboxScreen.tsx` — List of captures, File / File With AI / Delete.
- `NewCardScreen.tsx` — Full form with AI assist panel, status, source, related.
- `CardListScreen.tsx`, `CardViewer.tsx`, `CardThreadView.tsx`.
- `AskCardsScreen.tsx`.
- Navigation-related render functions in `App.tsx` (RenderHomeScreen, RenderQuickCaptureScreen, etc.).

### Styles & Theming
- `styles.ts` (many shared components: heroCard, inboxCard, formTitle, segmentedRow, etc.).
- `theme.ts`, `branding.ts`.

---

## 4. History & Key Decisions (High-Level Timeline)

**Early Work**:
- Initial monolith in `App.tsx` with manual `currentScreen` + swipe.
- Git setup and push to GitHub.
- Render backend setup.

**Phase 0 (Refactor & Foundations)**:
- Extracted to Zustand, proper persistence, types.
- Introduced React Navigation `MainStack` + `navigateTo` as "final optimization".
- Kept custom swipe for UX (underlay/foreground).
- Loading states, better logging, ErrorBoundary.
- Backup improvements.
- Decision to stay on JSON for now (note about sqlite for Phase 1+).

**Phase 1 Attempts (Todos, Events, Typed Quick Notes)**:
- Added `Todo`, `CalendarEvent` to types.
- Extended store, persistence (new files + load/save).
- QuickCapture gained type segmented control (Card / Todo / Event).
- `TodoListScreen` with nesting (parents/children, indent, +Sub, Complete, Delete).
- `EventListScreen`.
- Home gained todo/event counts + View buttons.
- Inbox gained type labels + "To Todo" / "To Event" buttons.
- Turn logic + AI branches that could generate parent + sub-todos from multiline content.
- Navigation integration in MainStack.
- This work was added, caused many bugs (navigator registration, scroll, keyboard, re-renders, data loss in backup, etc.), then **fully reverted**.

**Reverts & Stabilization**:
- Multiple rounds of removing todo/event code from types, store, persistence, App.tsx, Home, Inbox, QuickCapture.
- Files `TodoListScreen.tsx` and `EventListScreen.tsx` deleted.
- UI fixes by user (scrolling, buttons, keyboard, whitespace).
- Git commit + tag created for the stable point (`v0.9-stable-ui`).
- Branch `stable/pre-phase1-ui` created as working copy of the anchor.
- Current working tree has user's UI stabilization changes committed in the stable baseline.

**Recent Planning (just before this summary)**:
- Confirmed clean pre-Phase 1 state.
- User requested to begin **Phase 1 planning focused on**:
  - Implementation of a Todo list.
  - Quick Capture that can **recognize and generate** todos.
- Planning todos created.
- Baseline analysis complete.
- Initial scope, data model (nested Todo), Quick Capture type support, storage, UI, AI, nav integration sketched.
- Questions left open for user (manual type vs auto-detect, nesting depth, AI role, etc.).

**Git Workflow Established**:
- Development → `master`.
- Stable anchors via annotated tags (e.g. `v0.9-stable-ui`).
- Comparison/rollback via `git diff <tag>` and `git checkout <tag>`.
- Future stables should use new tags (e.g. `v1.0-stable-ui`).

---

## 5. Known Issues / Gotchas (from History)

- Hybrid nav + custom swipe frequently causes:
  - "Another navigator is already registered" errors.
  - Re-mounts / state loss.
  - Keyboard + gesture conflicts.
  - Scroll problems inside forms and lists.
- Large AI panels in NewCardScreen make forms very tall → need proper ScrollView + KeyboardAvoidingView.
- Backup/restore must be kept in sync when adding new data types.
- Render server cold starts (use UptimeRobot if deployed).
- Many render functions in App.tsx (`RenderXxxScreen`) are recreated on every render (performance smell).
- `currentScreen` state is still dual-used with RN navigation (source of bugs).
- No SQLite yet — relational needs (nesting, relations) will get painful.
- No tests for new features yet (regression script exists but is minimal).

---

## 6. Planned Phase 1 (Todo-Focused Slice) — Status as of End of Session

**High-Level Goal**: Make Quick Capture a true catch-all that can produce structured, nestable todos, and provide a first-class Todo list.

### Key Decisions / Scope (from planning discussion)
- Focus on **todos** first (calendar events later).
- Support **nesting** (`parentId`) from the beginning.
- Add type awareness to Quick Capture (segmented: "Card Idea" | "Todo List").
- Generation = combination of local parsing (newlines, `- `, numbers) + AI structuring.
- Todos stored separately but integrable with cards (via `relatedAddresses`).
- Inbox should support "Turn into Todo".
- Home should show todo counts and navigation.

### Proposed Data Model
```ts
export interface Todo {
  id: string;
  title: string;
  content?: string;
  completed: boolean;
  parentId?: string;           // null/undefined = parent
  createdAt: string;
  relatedAddresses?: string[]; // link to cards
}

// Optional: extend InboxCapture
export interface InboxCapture {
  ...
  intendedType?: 'card' | 'todo';
}
```

### Major Areas to Implement (in recommended small-chunk order)

1. **Data Layer**
   - Add `Todo` interface to `types.ts`.
   - Extend `dataStore.ts` (todos array + setters).
   - Update `persistence.ts` (TODOS_FILE, save/loadTodos, include in loadAllData + backups).
   - Update backup/restore logic.

2. **Quick Capture Todo Mode**
   - Add segmented type picker to `QuickCaptureScreen.tsx` (Card Idea / Todo List).
   - In `App.tsx`: `saveQuickCaptureToInbox` branches on type.
   - Basic parser: split content into parent + subs.
   - Create `Todo[]` and save directly (or via new store method).

3. **Todo Storage Wiring**
   - Wire todo load/save in `loadData`, `save*` functions.
   - Update `createBackupData` / restore.

4. **Basic TodoListScreen**
   - New component (or restore cleaned version from history).
   - Display parents + indented children.
   - Toggle complete, delete, basic +Sub (hardcoded title first).
   - Empty state.

5. **Navigation & Home Integration**
   - Add `todoList` to MainStack.
   - Update `renderHomeScreen` with todoCount + "View Todos" button.
   - `navigateTo('todoList')`.

6. **Inbox Integration**
   - Add "Turn into Todo" button in `InboxScreen`.
   - Handler in App.tsx that parses capture content into todos + deletes capture.

7. **AI / Structuring Enhancement**
   - Extend `CaptureStructuringResult` or create todo-specific result.
   - Update `useCaptureStructuring` / `aiCaptureStructuring` for todo output.
   - Update server if needed for structured todo generation.
   - "File With AI" path that can produce todos.

8. **Polish & Cross-Cutting**
   - Add todos to backup/restore fully.
   - Proper ScrollView + KeyboardAvoidingView on todo-related forms.
   - Update swipe logic to disable on todo screens if needed.
   - Nesting UI refinements (add sub with prompt, drag? later).
   - Possibly update AI prompts in docs/.

### Incremental Philosophy (per user history)
- Small chunks only.
- Verify with `tsc`, manual test, git diff.
- Always have a clean commit/tag before big changes.
- Use the `v0.9-stable-ui` tag as the "before" for every Phase 1 increment.

---

## 7. How to Continue in a Future Session

1. **Start here**:
   ```bash
   cd C:\Users\thoma\Antinet
   git checkout master
   git pull origin master
   git diff v0.9-stable-ui   # review what changed since stable
   ```

2. **Read this file first**, then:
   - `README.md` (if exists)
   - `docs/second-mind-ai-rewrite-contract.md`
   - `docs/second-mind-filing-policy.md`
   - `RENDER_DEPLOY.md`

3. **To experiment safely**:
   ```bash
   git checkout -b feature/phase1-todos
   # work
   git commit ...
   ```

4. **To compare/rollback**:
   ```bash
   git checkout v0.9-stable-ui
   git checkout -b experiment/from-stable
   ```

5. **When you reach a new stable point**:
   ```bash
   git tag -a v0.10-stable-todos -m "Todos + Quick Capture todo generation complete"
   git push origin v0.10-stable-todos
   ```

---

## 8. Open Questions & Next Immediate Steps

Open questions are resolved (see "Open Questions — Resolved" in the Phase 1 plan section above).

**Immediate next action**:
On `feature/phase-a-routing`, continue **Phase A — Unified AI Capture Routing**:
1. [x] **A1** (2026-06-18): `docs/second-mind-capture-routing-contract.md` — classify → enrich-card OR generate-todos contract.
2. [x] **A2** (2026-06-18): Capture job types, `utils/captureJobs.ts`, `useCaptureJobs` hook, `secondMindCaptureJobs.json` persistence.
3. [x] **A3** (2026-06-18): Server endpoints `classify-capture`, `enrich-card-capture`, `generate-todos` in `server/captureRouting.js`.
4. [x] **A4** (2026-06-18): Quick Capture single-submit, `useCaptureRouting` job pipeline (classify → enrich/generate).
5. [x] **A5** (2026-06-18): Home processing indicator + tap-to-expand job list modal.
6. **A6–A8**: Inbox prefilled draft, enriched inbox UI, clarifying modal.

---

## 9. Original Full Multi-Phase Vision (from the very beginning)

This section reconstructs the high-level multi-phase plan as originally described by the user at the start of the project. This is important context for "where we left off" and future direction. It was *not* a rigid sequential plan — the user emphasized step-by-step in layman's terms, smaller chunks after getting stuck, and holding off on EAS/builds until ready for trials.

### Core Vision
Evolve the Antinet/Second Mind Expo RN app into a complete personal assistant:
- **Quick Notes** as a catch-all for cards, todos, and calendar events.
- Ability to **generate nested todos/events/reminders** from rough notes.
- Evolve the existing AI ("Ask My Cards" + filing) into a **full personal assistant** that has access to cards + todos + events for integrated practical and intellectual life.
- Eventually add **voice-powered** input and **widgets**.
- Goal: App Store / Play Store ready.

The user repeatedly stressed:
- Proceed in **smaller chunks**.
- Give progress notes.
- Hold off on EAS builds until ready for trials.
- "Lets roll" through phases but stop and explain when stuck.

### Phase 0 (Foundation / Monolith Refactor)
Focus on making the existing app robust before adding major new features:
1. Monolith refactor (App.tsx was very large).
2. Proper data layer (types, Zustand store, JSON persistence via expo-file-system).
3. State management cleanup.
4. Navigation improvements (started with custom swipe, later layered React Navigation Stack while keeping swipe UX).
5. Persistence improvements (load/save, versioning, backups with sharing, migration).
6. Error handling, loading states, logging.
7. Backend (local Node server proxy to xAI/Grok for structured outputs; later Render deployment).
8. Keep cards/inbox/categories/AI filing working stably.

Key principle from this phase: "final optimization from phase 0" included introducing `MainStack` + `navigateTo` helper while preserving the custom swipe underlay/foreground system.

### Phase 1 (Feature Expansion)
Build the "Quick Notes as catch-all" and assistant capabilities:
- Extend Quick Capture to handle different types (Card Idea / Todo List / Calendar Event).
- Generate **nested todos** (parent + sub-tasks) from multi-line content, both manually and via AI.
- Add support for **Calendar Events**.
- Create dedicated screens: TodoListScreen (with nesting UI: parents/children, indent, complete, +Sub, delete), EventListScreen.
- Update Home with counts and "View Todos / View Events" buttons.
- Update Inbox with type labels and "To Todo" / "To Event" actions.
- Integrate AI so "File With AI" can produce structured todos/events.
- Expand the assistant context so AI (Ask My Cards) can reason over cards + todos + events together.
- Update persistence, store, types, navigation, and backup/restore to support the new entities.
- Note: "JSON now + sqlite later for relational" (todos/events have nesting/relations).

The user asked at one point whether Phase 1 and 2 should be simultaneous, but the main instruction was to do Phase 0 foundations first, then roll into Phase 1 features incrementally.

### Later / Future Phases (mentioned in original vision)
- Voice-powered input.
- Widgets.
- Full App Store / Play Store readiness (EAS builds, when ready for trials).
- More advanced AI assistant behaviors.

### Important Notes from Original Instructions
- "step-by-step in layman's terms, progress notes, smaller chunks after 'stuck' complaint."
- "ok we will hold off on EAS until I am ready to deploy trials."
- "If need be make changes in smaller chunks and return with progress notes."
- Heavy emphasis on not getting stuck in loops — break things down.

This original vision is what guided the entire project. The recent work has been focused on getting back to a clean pre-Phase 1 state so we can re-implement the todo part of Phase 1 cleanly.

---

**End of Session Summary**

This file should be the first thing read in any future session. Update it at the end of each major piece of work.

Last updated by Grok on 2026-06-18 — Chunks 1–5 complete on `feature/phase1-todos` (data layer through TodoListScreen + Home).