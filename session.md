# Second Mind / Antinet — Session Handoff

> **Single continuity file.** This document replaces the former `session_summary.md`. Read it first in every new session; update it at the end of major work.

**Last updated:** 2026-06-18
**Project path:** `C:\Users\thoma\antinet` (git root may show as `Antinet`)  
**Git remote:** `https://github.com/thall14t/second-mind.git`  
**Current branch:** `feature/phase-a-routing`  
**Render AI service:** `second-mind-ai` — branch set to `feature/phase-a-routing`, deployed and live (health 200)  
**Stable tags:** `v0.10-stable-todos` (Phase 1), `v0.9-stable-ui` (pre-Phase 1 UI baseline)  
**App stack:** Expo ~54, React Native 0.81, React 19, Zustand, JSON persistence, Node AI server on Render

---

## ⚠️ Directive for the Next AI Session (READ FIRST)

**On opening a new session:**

1. **Read this entire file** before running commands or editing code.
2. **Do not implement changes, refactors, or fixes** until the user gives an explicit task.
3. **Stand in a ready state** — acknowledge context, confirm deployment/branch state if needed, wait for instructions.
4. The user’s **planned first action** in the new session is a **stress test of Quick Capture** to measure routing/enrichment/todo accuracy and find breakage points.

**Do not** “proactively fix” or “improve” anything on session open.

---

## What the User Will Do Next

- Run / extend **`scripts/run-capture-routing-stress-test.js`** (or manual Quick Capture scenarios).
- Evaluate **classification** (card vs todo), **enrichment** (fields, source, related cards), **filing** (category vs manual review), and **todo generation** (including append-to-list).
- Report failures with capture text + what the app showed.

---

## Current Deployment & Dev Setup

| Piece | Where it runs |
|--------|----------------|
| **AI server** | Render (`node server/index.js`) — `npm run ai-server` locally |
| **Expo app** | Expo Go via Metro on dev machine (`npx expo start -c`) |
| **AI URL in app** | Settings → Developer Settings → Render URL (user confirmed configured) |

**Deploy flow (reference):**
1. Commit + push to `feature/phase-a-routing`
2. Render → Manual Deploy → Deploy latest commit (not Restart alone)
3. Reload Expo Go after client changes

**Key env on Render:** `XAI_API_KEY` (manual), `AI_MODEL=grok-4-1-fast`, `AI_PROVIDER=xai`

---

## Work Completed After “Phase A Complete” (This Extended Session)

Phase A shipped the unified routing pipeline. This session **hardened and extended** it:

### 1. Inbox & card open flow
- **Tap inbox card body** → opens File This with enrichment prefilled.
- **Auto filing** on open when pipeline stored `filingSuggestion`.
- **`loadCaptureIntoCardForm`** merges enrichment + filing via `buildCardFormFieldsFromCaptureEnrichment` (source, tags, related cards, title, content applied immediately).

### 2. AI-first routing (classify / enrich / generate)
- **`inferObviousCaptureRoute`** — chore lists, jeep+deadline, append phrasing (“add X to house chores”) route to todo with high confidence.
- **Server classify prompts** — fewer false clarifications; suppression when confidence ≥ ~0.42 and alternatives aren’t close.
- **`finalizeCaptureClassification`** — stricter clarification gate; plain chore list detection.

### 3. Card enrichment & research
- **Enrich endpoint** — research-oriented prompts; `max_output_tokens` **640** (was 320).
- **`existingCards`** (up to 50) sent in enrich payload; server may suggest up to **3 semantically related** card addresses.
- **`restrainStructuringToCapture`** — trusts AI (`strategy: 'ai'|'merged'`) for source attribution; strips invented source only on local fallbacks without cues.

### 4. Pipeline filing unified with manual “Suggest Filing”
- **`requestCaptureFiling`** now uses `buildFilingPlanV2` → `buildAiAssistPayload` → `finalizeFilingSuggestion` (same as manual filing), not stripped `buildCataloguingPayloadFromCategories`.
- Local **related-card matching** runs during background filing.

### 5. Todo append-to-existing-list
- **`utils/todoAppend.ts`** — parse “add X to house chores” / “add X to that list”, merge into existing todo tree.
- **`generate-todos`** context includes **`existingTodos`**; server prompt for append-only children with `parentClientId`.
- **`mergeTodoGenerationIntoExisting`** in pipeline + manual Turn into Todo.

### 6. Ready-to-file gate
- **`captureEnrichmentHasMeaningfulWork`** — inbox shows **Ready to file** only when AI ran (`strategy: 'ai'|'merged'`) or local enrichment actually changed something (not bare pass-through).

### 7. Filing “Why?” UX (latest)
- **`filingWhy`** on `CardFilingSuggestion` when downgraded to manual review.
- **`buildFilingWhyContext`** captures what AI **considered** before fields are cleared.
- **NewCardScreen** — **Why?** / **Hide why** expandable panel:
  - **Considered** — e.g. `New shelf "Our lord is love" under 0300-0399 — Ethics`
  - **Not applied** — rejection reason (e.g. reusable shelf name check failed)

### 8. Tests added/extended
- `scripts/run-todo-utils-tests.js` — append/merge tests
- `scripts/run-capture-jobs-tests.js` — append classify, ready-to-file gate
- `scripts/run-capture-routing-server-tests.js` — generate context with existingTodos
- `scripts/run-capture-routing-stress-test.js` — end-to-end stress harness (32 scenarios)
- `scripts/run-ai-filing-regression.js` — `filingWhy` / manual review fallback

**Verify locally:**
```powershell
cd C:\Users\thoma\antinet
npx tsc --noEmit
node scripts/run-capture-jobs-tests.js
node scripts/run-capture-routing-server-tests.js
node scripts/run-todo-utils-tests.js
node scripts/run-ai-filing-regression.js
node scripts/run-capture-routing-stress-test.js   # needs live AI server + API key
```

---

## Key Files Touched (Recent Work)

| Area | Files |
|------|--------|
| Routing pipeline | `hooks/useCaptureRouting.ts`, `utils/captureJobs.ts`, `server/captureRouting.js` |
| Enrichment | `utils/aiCataloguing.ts`, `server/index.js`, `hooks/useCaptureStructuring.ts` |
| Filing | `utils/aiFiling.ts`, `hooks/useAiFiling.ts`, `server/index.js` |
| Todo append | `utils/todoAppend.ts`, `utils/todoParsing.ts`, `utils/todoDates.ts` |
| UI | `App.tsx`, `components/InboxScreen.tsx`, `components/NewCardScreen.tsx`, `styles.ts` |
| Types | `types.ts` |
| Deploy | `render.yaml` |

---

## Phase A — Unified AI Capture Routing (COMPLETE)

**Contract:** `docs/second-mind-capture-routing-contract.md`

**Goal:** One Quick Capture submit → Home immediately → background AI routes to **card enrich** or **todo generate**.

| Chunk | Status | Delivers |
|-------|--------|----------|
| **A1** | ✅ | Capture routing contract doc |
| **A2** | ✅ | `CaptureJob` types, `utils/captureJobs.ts`, `useCaptureJobs`, `secondMindCaptureJobs.json` |
| **A3** | ✅ | Server: `classify-capture`, `enrich-card-capture`, `generate-todos` |
| **A4** | ✅ | Single-submit Quick Capture + `useCaptureRouting` pipeline |
| **A5** | ✅ | Home processing indicator + job list modal |
| **A6** | ✅ | File This prefills from `capture.enrichment` |
| **A7** | ✅ | Inbox ready-to-file UI, structured preview |
| **A8** | ✅ | Clarification modal + Choose Type |

**Pipeline (card route):**
```
Quick Capture → save InboxCapture + CaptureJob → Home
  → POST /api/classify-capture
  → card: POST /api/enrich-card-capture
       → POST /api/suggest-card-filing (full buildFilingPlanV2 path)
       → store enrichment + filingSuggestion on capture
  → todo: POST /api/generate-todos → merge todos → remove capture from inbox
```

**Clarification:** Rare (<10% target). User picks Library Note / Task List on Home or Inbox.

**Manual inbox actions (post-A):** File This (default enriched cards), File With AI (fallback), Turn into Todo, Delete.

---

## Phase B — Routing & Cataloguing Quality (IN PROGRESS / NEXT)

**Goal:** Make Quick Capture **accurate and trustworthy** under real captures—not just wired up.

Planned / active focus:

| Item | Status | Notes |
|------|--------|-------|
| **B1 Stress test harness** | ✅ Script exists | `run-capture-routing-stress-test.js` — run against live server |
| **B2 Classification accuracy** | 🔄 User testing next | Card vs todo, clarification rate, edge quotes/aphorisms |
| **B3 Enrichment quality** | 🔄 Partially validated | User confirmed quote fill + related card works on Render |
| **B4 Filing transparency** | ✅ Why? panel | Manual review shows considered vs not applied |
| **B5 Filing accuracy** | 🔄 Ongoing | Reusable shelf gate causes manual review on quote-like new category names |
| **B6 Todo append** | ✅ Implemented | “add task to list” path; needs stress validation |
| **B7 Benchmark doc** | 📋 | Capture scenarios + expected routes in contract § Benchmark Scenarios |

**Success criteria for Phase B:**
- Stress test report with pass/fail per scenario
- Clarification rate acceptable to user
- Card route: meaningful enrichment + filing or clear Why?
- Todo route: correct nesting, due dates, append-to-list

---

## Phase C — Assistant & Product Expansion (PLANNED)

**Goal:** Broader “personal assistant” vision beyond capture routing.

| Item | Description |
|------|-------------|
| **C1** | Expand **Ask My Cards** (and assistant) to include **todos** (+ eventually events) in context |
| **C2** | **Calendar events** entity (deferred from original Phase 1) |
| **C3** | Quick Capture quality UX polish from stress findings (prompt tuning, thresholds, UI copy) |
| **C4** | Optional **sqlite** for relational data (nested todos, relations) — noted in persistence comments |
| **C5** | **EAS builds** + App Store / Play Store trial readiness (user: hold until ready) |
| **C6** | **Voice input** and **widgets** (original long-term vision) |

Phase C assumes Phase B stress testing has produced a stable capture baseline.

---

## Phase 1 — Todos (COMPLETE — tag `v0.10-stable-todos`)

| Chunk | Status |
|-------|--------|
| Data layer (`Todo`, persistence) | ✅ |
| Quick Capture todo mode (later superseded by Phase A single-submit) | ✅ |
| TodoListScreen (nest, complete, delete, drag reorder) | ✅ |
| Home + navigation | ✅ |
| Inbox Turn into Todo | ✅ |
| Polish (inline edit, collapse, auto-save) | ✅ |
| AI todo structuring | ✅ Via Phase A `generate-todos` |

**Note:** Phase A removed the manual Card/Todo picker on Quick Capture; todos now come from classify → generate.

---

## Phase 0 — Foundation (COMPLETE)

Monolith refactor, Zustand, JSON persistence, hybrid navigation (RN Stack + custom swipe), AI server proxy, filing + structure-capture, backup/restore, ErrorBoundary, Render deploy path.

---

## Original Multi-Phase Vision (Project Genesis)

**Core vision:** Second Mind as a personal Antinet + assistant:

1. **Quick notes catch-all** → cards, todos, (later) events  
2. **Nested todos** from rough multiline capture  
3. **AI cataloguing** — structure, file, relate cards  
4. **Full assistant** — reason over cards + todos + events  
5. **Voice + widgets** → App Store / Play Store  

**User principles (recurring):**
- Small chunks, progress notes, layman-friendly explanations  
- Hold EAS/production builds until trial-ready  
- `git diff <stable-tag>` before big changes; tag new stables at milestones  
- Avoid getting stuck in revert loops — clean baselines (`v0.9-stable-ui`, `v0.10-stable-todos`)

**Rough phase map:**

| Phase | Focus | Status |
|-------|--------|--------|
| **0** | Foundation, cards, inbox, AI server | ✅ |
| **1** | Todos, nesting, inbox conversion | ✅ `v0.10-stable-todos` |
| **A** | Unified AI capture routing | ✅ on `feature/phase-a-routing` |
| **B** | Accuracy, stress tests, filing UX | 🔄 **current** |
| **C** | Assistant expansion, events, store | 📋 planned |

---

## Architecture Quick Reference

### AI endpoints (`server/index.js` + `server/captureRouting.js`)
- `POST /api/classify-capture` — card vs todo  
- `POST /api/enrich-card-capture` — structure + research + related cards  
- `POST /api/generate-todos` — nestable todos + append context  
- `POST /api/suggest-card-filing` — category placement (taxonomy from client)  
- `POST /api/structure-capture` — legacy; File With AI fallback  
- `POST /api/ask-cards` — Q&A over cards  
- `GET /health` — Render smoke test  

### Client hooks
- `useCaptureRouting` — classify → enrich/generate → filing (cards)  
- `useCaptureJobs` — job persistence  
- `useCaptureStructuring` — manual File With AI  
- `useAiFiling` — Suggest Filing on new card form  

### Filing manual review triggers (`finalizeFilingSuggestion`)
- Invalid existing category range from AI  
- Invalid new-category parent range  
- **`isReusableShelfTitle` fails** → “could not verify a reusable new category name” (+ `filingWhy`)  
- Confidence band **low** (<0.58)  
- AI returned `manual_review` with no alternatives  

### Data persistence (JSON via expo-file-system)
- `antinetCards.json`, `secondMindInboxCaptures.json`, `secondMindTodos.json`, `secondMindCaptureJobs.json`, categories, settings  

---

## Known Gotchas

- **Render free tier** cold start ~20–40s after idle  
- **Hybrid navigation** (custom swipe + RN Stack) — historical source of bugs  
- **Expo Go** loads **client JS from Metro**; **server code from Render** — both must be current  
- **Manual review** hides Apply All / Use Category; user picks alternatives or Choose Category  
- **filingWhy** only on suggestions created **after** Why? feature; re-run Suggest Different to refresh  
- Git may show untracked `mcps/`, `terminals/`, `scripts/.tmp-*` — **do not commit** (in `.gitignore` if added)

---

## Git State (End of Session)

- Branch: `feature/phase-a-routing`  
- Pushed to GitHub; Render deploys this branch  
- Recent commit theme: capture routing, card enrichment, todo append, filing Why? panel  
- User should **not** use `git add .` without excluding temp folders  

---

## Open Questions / Stress Test Focus Areas

1. **Classification** — quotes, mixed paragraphs, single imperatives, comma errand lists  
2. **Clarification rate** — too many vs too few?  
3. **Enrichment** — source attribution without bible-specific hacks; when fields look “unchanged”  
4. **Filing** — manual review frequency; are alternative chips helpful?  
5. **Todo append** — “add to that list” vs named list; multiple appends  
6. **Offline / timeout** — local fallbacks still usable?  

---

## Git Workflow (Quick Reference)

```powershell
cd C:\Users\thoma\antinet
git status
git diff v0.10-stable-todos    # compare to last todo stable
git diff v0.9-stable-ui        # compare to pre-Phase-1 UI baseline
```

- Develop on feature branches (e.g. `feature/phase-a-routing`); tag stables at milestones.
- Do **not** `git add .` blindly — exclude `mcps/`, `terminals/`, `scripts/.tmp-*/`.
- Commit updates to **`session.md`** together with meaningful code changes.

## Related Docs

- `docs/second-mind-capture-routing-contract.md` — Phase A canonical contract  
- `docs/second-mind-ai-rewrite-contract.md` — structuring vs filing boundaries  
- `docs/second-mind-filing-policy.md` — filing policy  
- `server/README.md` — local AI server setup  
- `RENDER_DEPLOY.md` — Render deploy steps  

---

**End of handoff.** Next agent: read, confirm ready, wait for user’s stress-test instructions.

---

## Refined Vision: True Second Mind

Core intake surface (Quick Notes / generalized Inbox):
- A single fast-capture place for anything.
- Intelligently (or with light user guidance) routes or splits into:
  - Intellectual → structured Cards (current strength, with better filing)
  - Actionable → nested Todos / task lists
  - Time-bound → Calendar events
  - Hybrids (a capture can spawn multiple things)

Unified data fabric:
- Cards (knowledge, ideas, sources)
- Todos (nested, actionable, with status/due/related)
- Events (calendar items with reminders)
- Rich bidirectional + multi-type links (a todo can reference card addresses; an event can pull in related cards/todos; cards can reference open todos)

The AI layer evolves from two special tools ("File with AI" + "Ask My Cards") into a personal assistant that:
- Has read/write access (via safe, structured interfaces) to the full catalog + todos + events.
- Can answer, plan, generate, remind, and connect domains ("What cards relate to the project I’m behind on?", "Build a reading plan using my 0100 cards + current todos", "Remind me tomorrow about X and link the relevant card").
- Supports proactive / scheduled behaviors over time.

Quick Notes becomes the universal front door (future: voice + widgets).

The filing/categorization system must stay best-in-class on both speed and accuracy.

---

## Recommended Trajectory & Order of Operations

Do not try to build the full vision at once. The current system is already quite sophisticated in its AI contracts and heuristics — preserve that while layering the new capabilities.

### Phase 0 – Foundation & Breathing Room
- Refactor the monolith (App.tsx is currently the biggest technical debt).
  - Introduce a thin data/service layer (e.g., CardStore, CaptureStore, later TodoStore, EventStore, LinkService).
  - Move toward proper state management (Zustand or Jotai recommended).
  - Replace the manual screen + back logic with React Navigation (stack + tabs or a custom drawer) + proper deep linking.
- Improve persistence:
  - Add data versioning + migration support.
  - Add one-click full backup/export (JSON dump to share sheet or file).
  - Strongly consider expo-sqlite for new relational data. Keep JSON for immutable card history if preferred.
- Expand the existing regression/scripting harness to cover new generation paths.
- Add basic error boundaries, loading states, and logging for AI calls.

*Why first? Everything else becomes painful and risky without this. It also makes the speed/accuracy work easier because you can experiment in isolation.*

### Phase 1 – Quick Notes as True Catch-All + Structured Generation
- Rename/generalize InboxCapture → QuickNote (or keep inbox as a processing queue).
- Enhance the capture screen so a single rough note can become:
  - One or more cards (current path)
  - A nested todo list (with AI generation of hierarchy, priorities, next actions)
  - One or more calendar events
  - Mix (e.g., "idea for X" card + "follow up on X" todo + "meeting about X" event)
- Implement minimal viable Todo and CalendarEvent models + basic CRUD screens/lists.
  - Todos: nesting (parent/child or tree), status, due date, related addresses, source capture.
  - Events: title, start/end (or all-day), location/notes, related items, reminder settings.
- Add generation capabilities:
  - New (or extended) server endpoints: `POST /api/generate-todos`, `/api/generate-events`.
  - Reuse/enhance the existing structuring + function classification logic.
- Update Inbox to show type or multi-action buttons ("File as Card(s)", "Turn into Todos", "Create Event", "All of the above").

*Goal: You can take a voice note or quick scribble and have it productively spawn the right artifacts without losing the original capture.*

### Phase 2 – AI Categorization Speed + Accuracy *(run in parallel with Phase 1)*
Concrete suggestions to resolve the speed/accuracy trade-off:

- **Stronger retrieval-first layer (biggest lever):** Pre-compute lightweight representations (TF-IDF or simple embeddings) for every leaf + range. On a new capture, do fast local retrieval of top 3–8 candidates + their parents, then only send that tiny slice + top-level branches to the LLM.
- **Tiered / progressive pipeline:**
  1. Instant local heuristic + function classifier (excellent cues already in `aiCataloguing.ts`).
  2. Fast cheap model (or cached) for 70–80% of cases.
  3. Powerful model only on uncertainty / "new category" / high-stakes.
- **Semantic + exact caching (very high ROI):** Cache not just by exact payload but by embedding similarity or canonicalized key.
- **Immediate local preview + async upgrade:** Show a good-enough local suggestion in <1s while the AI runs. Let the user proceed or wait for the AI-refined version.
- **Reduce what you send:** Never dump the entire tree. Use the top-level router + usage signals to narrow hard.
- **Feedback loop:** When a user overrides or corrects a suggestion, log it locally and use it to bias future heuristics or as few-shot examples in prompts.
- **Measurement contract:** Define success metrics now (p50/p95 latency for "suggest filing", acceptance rate, manual-review rate, override reasons). Run the existing regression harness against new strategies.
- **Optional longer-term:** Support local LLM backends (Ollama/LM Studio) for the fast path.

*Do not chase pure accuracy at the expense of the UI feeling slow. Perceived speed + graceful degradation wins.*

### Phase 3 – Cross-Domain Links + Basic Reminders
- Add linking primitives (a todo or event can reference card addresses and vice versa).
- Simple local notification system (using expo-notifications) for due todos and upcoming events.
- AI can now "generate reminders" or suggest due dates/reminder cadences from captures.
- Basic views: Todo list (with nesting), upcoming calendar, "Today" or "Actionable" dashboard that mixes open todos + today’s events + relevant cards.

### Phase 4 – Unified Personal Assistant
- Evolve "Ask My Cards" into "Ask Second Mind" / a dedicated assistant interface (chat-like or structured query + actions).
- Expand the server:
  - Rich context payload (or retrieval-augmented): selected/relevant cards + open todos + upcoming events.
  - New capabilities: planning, cross-domain answers, generation of mixed artifacts, "what should I do next?", proactive suggestions.
  - Keep strict grounding + citation where possible.
- Add "Assistant-suggested actions" that the user can accept (creates todos/events/cards).

### Phase 5 – Voice, Widgets, and Real-World Access
- Voice: Device speech-to-text into Quick Notes (start simple), later richer server-side processing if needed.
- Widgets + quick actions (iOS/Android home screen or notification center shortcuts).
- More sophisticated reminders (recurring, location-based if useful, bundled "daily briefing" notifications).
- Optional: device calendar integration (expo-calendar) for two-way sync or one-way export of internal events.

### Phase 6 – Resilience & Scale *(ongoing)*
- Proper sync/backup story (manual export first, then iCloud Files / Dropbox / self-hosted, or local-first sync).
- Offline resilience.
- Conflict handling for cross-device.
- Cost/privacy controls (data minimization, local-only AI mode, summaries instead of raw dumps for assistant context).
- Performance (indexing, virtualized lists for large collections).

---

## Additional Notes on Current Obstacles

**Monolith + navigation/back logic:** React Navigation + a service layer will make adding todo/event screens and an assistant far less painful than the current conditional-render + giant `goBack` function.

**Persistence (JSON files):** Works for the current small scope but will become a liability with todos + events + links + reminders. SQLite gives relations and queries for free. Keep cards as append-only JSON if the "immutable slip box" feeling is important.

**AI server friction (localhost + phone IP):** Make the endpoint configurable and obvious. Add a health check button in settings. Support alternative providers and local LLMs in the server config.

**Lack of backup/sync:** Implement full export/import as Phase 0/1 deliverable. Users will feel safe experimenting.

**"Ask" becoming full assistant:** The current strict grounding is a feature — keep variants of it ("grounded knowledge mode") while adding a more agentic/planning mode. Be explicit in the UI about what the assistant can see and change.

**General:**
- Treat the excellent filing policy and AI rewrite contract docs as sacred. Extend the same rigor to new todo/event generation and assistant behavior (new small policy docs).
- Add feature flags or a "Labs" section so you can ship partial versions.
- Expand the test data (already have `testCards`/`testCaptures`) to include practical/actionable examples.
- For calendar specifically, decide philosophy early: Is the internal calendar the "source of truth" for Second Mind (recommended), with optional device sync? Or is it primarily a bridge?