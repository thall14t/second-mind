// App-wide constants — one source of truth for timeouts, limits, and defaults.
// Import from here instead of defining magic numbers inline.

// ── AI server ────────────────────────────────────────────────────────────────

export const DEFAULT_AI_ASSIST_ENDPOINT = 'http://localhost:3001';

// ── Per-request timeouts (ms) ────────────────────────────────────────────────

export const CLASSIFY_CAPTURE_TIMEOUT_MS = 12_000;
export const ENRICH_CAPTURE_TIMEOUT_MS = 18_000;
export const GENERATE_TODOS_TIMEOUT_MS = 18_000;
export const FILING_SUGGESTION_TIMEOUT_MS = 20_000;
export const ROUTE_AND_ENRICH_TIMEOUT_MS = 24_000;
export const ASK_CARDS_TIMEOUT_MS = 20_000;
export const CAPTURE_STRUCTURING_TIMEOUT_MS = 18_000;

// ── Client-side caches ───────────────────────────────────────────────────────

export const AI_RESPONSE_CACHE_LIMIT = 40;

// ── Pipeline limits ──────────────────────────────────────────────────────────

export const MAX_CAPTURE_CLARIFICATION_ROUNDS = 2;

// ── Content truncation ───────────────────────────────────────────────────────

// Max characters of card content sent to AI (ask-cards payload, structuring preview)
export const AI_CARD_CONTENT_MAX_CHARS = 1_200;
