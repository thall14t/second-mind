const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);

loadEnvFile(path.join(__dirname, '.env'));

const PROVIDER = (process.env.AI_PROVIDER || 'xai').toLowerCase();
const DEFAULT_BASE_URL = PROVIDER === 'openai' ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1';
const API_BASE_URL = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const RESPONSES_URL = `${API_BASE_URL}/responses`;
const API_KEY = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
const MODEL = process.env.AI_MODEL || process.env.XAI_MODEL || process.env.OPENAI_MODEL || (PROVIDER === 'openai' ? 'gpt-5.2' : 'grok-4-1-fast');
const AI_SERVER_CACHE_LIMIT = 48;
const filingSuggestionCache = new Map();
const filingSuggestionInFlight = new Map();
const filingCoreSuggestionCache = new Map();
const filingCoreSuggestionInFlight = new Map();
const captureStructuringCache = new Map();
const captureStructuringInFlight = new Map();
const captureClassificationCache = new Map();
const captureClassificationInFlight = new Map();
const captureEnrichmentCache = new Map();
const captureEnrichmentInFlight = new Map();
const todoGenerationCache = new Map();
const todoGenerationInFlight = new Map();

const {
  requestClassifyCapture,
  requestEnrichCardCapture,
  requestGenerateTodos,
} = require('./captureRouting');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }
}

const filingRegionSelectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['selectedTopLevelRanges', 'reasoning', 'confidence'],
  properties: {
    selectedTopLevelRanges: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: { type: 'string' },
    },
    reasoning: { type: 'string' },
    confidence: { type: 'number' },
  },
};

const coreSuggestionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'mode',
    'selectedMasterRange',
    'selectedMasterRangeTitle',
    'suggestedCategoryId',
    'suggestedCategoryRange',
    'suggestedCategoryTitle',
    'suggestedParentRange',
    'suggestedParentTitle',
    'suggestedNewCategoryRange',
    'suggestedNewCategoryTitle',
    'suggestedCardAddress',
    'reasoning',
    'confidence',
  ],
  properties: {
    mode: { type: 'string', enum: ['existing_category', 'new_category', 'manual_review'] },
    selectedMasterRange: { type: 'string' },
    selectedMasterRangeTitle: { type: 'string' },
    suggestedCategoryId: { type: 'string' },
    suggestedCategoryRange: { type: 'string' },
    suggestedCategoryTitle: { type: 'string' },
    suggestedParentRange: { type: 'string' },
    suggestedParentTitle: { type: 'string' },
    suggestedNewCategoryRange: { type: 'string' },
    suggestedNewCategoryTitle: { type: 'string' },
    suggestedCardAddress: { type: 'string' },
    reasoning: { type: 'string' },
    confidence: { type: 'number' },
  },
};

const captureStructuringSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestedTitle', 'suggestedContent', 'suggestedSource', 'corrections', 'confidence'],
  properties: {
    suggestedTitle: { type: 'string' },
    suggestedContent: { type: 'string' },
    suggestedSource: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'title', 'author', 'url', 'page', 'note'],
      properties: {
        type: { type: 'string', enum: ['Web', 'Book', 'Article', 'Video', 'Other'] },
        title: { type: 'string' },
        author: { type: 'string' },
        url: { type: 'string' },
        page: { type: 'string' },
        note: { type: 'string' },
      },
    },
    corrections: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
};

const askCardsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'referencedAddresses', 'suggestedFollowUps', 'confidence'],
  properties: {
    answer: { type: 'string' },
    referencedAddresses: { type: 'array', items: { type: 'string' } },
    suggestedFollowUps: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
};

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);
  const route = req.url?.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && route === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    if (!API_KEY) {
      sendJson(res, 500, { error: 'Missing XAI_API_KEY or OPENAI_API_KEY in server/.env' });
      return;
    }

    const body = await readJsonBody(req);
    if (route === '/api/suggest-card-filing') {
      const suggestion = await withCachedAiResponse(
        filingSuggestionCache,
        filingSuggestionInFlight,
        buildAiCacheKey(body),
        () => requestAiSuggestion(body)
      );
      sendJson(res, 200, { suggestion });
      return;
    }

    if (route === '/api/suggest-card-filing-core') {
      const suggestion = await withCachedAiResponse(
        filingCoreSuggestionCache,
        filingCoreSuggestionInFlight,
        buildAiCacheKey(body),
        () => requestAiCoreSuggestion(body)
      );
      sendJson(res, 200, { suggestion });
      return;
    }

    if (route === '/api/structure-capture') {
      const result = await withCachedAiResponse(
        captureStructuringCache,
        captureStructuringInFlight,
        buildAiCacheKey(body),
        () => requestCaptureStructuring(body)
      );
      sendJson(res, 200, { result });
      return;
    }

    if (route === '/api/classify-capture') {
      const result = await withCachedAiResponse(
        captureClassificationCache,
        captureClassificationInFlight,
        buildAiCacheKey(body),
        () => requestClassifyCapture(body, buildCaptureRoutingDeps())
      );
      sendJson(res, 200, { result });
      return;
    }

    if (route === '/api/enrich-card-capture') {
      const result = await withCachedAiResponse(
        captureEnrichmentCache,
        captureEnrichmentInFlight,
        buildAiCacheKey(body),
        () => requestEnrichCardCapture(body, requestCaptureStructuring)
      );
      sendJson(res, 200, { result });
      return;
    }

    if (route === '/api/generate-todos') {
      const result = await withCachedAiResponse(
        todoGenerationCache,
        todoGenerationInFlight,
        buildAiCacheKey(body),
        () => requestGenerateTodos(body, buildCaptureRoutingDeps())
      );
      sendJson(res, 200, { result });
      return;
    }

    if (route === '/api/ask-cards') {
      const result = await requestAskCardsAnswer(body);
      sendJson(res, 200, { result });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    sendJson(res, 500, { error: message });
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. The Second Mind AI server is probably already running.`);
    console.error(`Use http://127.0.0.1:${PORT}/health to check it, or stop the existing node process before starting another one.`);
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Second Mind AI server listening on http://0.0.0.0:${PORT}`);
  console.log(`AI provider: ${PROVIDER} | model: ${MODEL} | base URL: ${API_BASE_URL}`);
});

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk;
      if (rawBody.length > 1_000_000) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function buildAiCacheKey(value) {
  return JSON.stringify(value);
}

function buildCaptureRoutingDeps() {
  return {
    apiKey: API_KEY,
    model: MODEL,
    responsesUrl: RESPONSES_URL,
    fetch,
    extractOutputText,
  };
}

function rememberCachedAiValue(cache, key, value) {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);
  if (cache.size > AI_SERVER_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

function withCachedAiResponse(cache, inFlight, key, task) {
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key));
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = Promise.resolve()
    .then(task)
    .then(result => {
      rememberCachedAiValue(cache, key, result);
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

async function requestAiSuggestion(body) {
  const requestStartedAt = Date.now();
  const context = prepareTaxonomyAgnosticFilingContext(body);
  const coreStartedAt = Date.now();
  const coreSuggestion = await requestCoreFilingSuggestion(context);
  const coreDurationMs = Date.now() - coreStartedAt;
  const suggestion = buildFullSuggestionFromCore(coreSuggestion, body?.draft);
  const coreBytes = Buffer.byteLength(JSON.stringify(context), 'utf8');
  console.log(
    `[AI] suggest-card-filing strategy=one-call core=${coreDurationMs}ms total=${Date.now() - requestStartedAt}ms topLevels=${context.topLevelCategories.length} contextBytes=${coreBytes}`
  );

  return suggestion;
}

async function requestAiCoreSuggestion(body) {
  const requestStartedAt = Date.now();
  const context = prepareTaxonomyAgnosticFilingContext(body);
  const coreStartedAt = Date.now();
  const suggestion = await requestCoreFilingSuggestion(context);
  const coreDurationMs = Date.now() - coreStartedAt;
  console.log(
    `[AI] suggest-card-filing-core core=${coreDurationMs}ms total=${Date.now() - requestStartedAt}ms topLevels=${context.topLevelCategories.length} contextBytes=${Buffer.byteLength(JSON.stringify(context), 'utf8')}`
  );

  return suggestion;
}

async function requestCoreFilingSuggestion(context) {
  return requestCoreFilingSuggestionWithRetry(context, 0);
}

async function requestCoreFilingSuggestionWithRetry(context, attempt) {
  const tokenBudget = attempt === 0 ? 170 : 240;
  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are the intelligent filing assistant for Second Mind, a personal Antinet-style knowledge system.',
                'Your only job is to suggest the best place to file a new card using only the taxonomy provided in this request.',
                'Do not assume any fixed meaning for category numbers beyond the titles and hierarchy shown here.',
                'The provided taxonomy includes all top-level ranges, their immediate children, and a selected set of real filing shelves from the user\'s live category tree.',
                'Use note function as well as subject. Consider whether the draft is a quote, source note, idea seed, project note, practical method, observation, analogy, metaphor, doctrine, or argument.',
                'When note function conflicts with a literal noun, prefer the note function if the evidence is clear.',
                'When the draft explicitly frames itself as a book idea, chapter idea, story idea, essay idea, article idea, sermon idea, or talk idea, prefer authored-work, literary, creative, or idea-oriented branches and shelves when such options exist.',
                'Prefer an existing category when it clearly fits.',
                'Only suggest creating a new category when no existing leaf category is a good fit.',
                'Leaf nodes are existing filing shelves. Non-leaf nodes are ranges that can host a new category.',
                'For mode existing_category, choose one existing leaf node from the provided taxonomy and copy its exact id, range, and title into the response.',
                'For mode new_category, choose one non-leaf host range from the provided taxonomy and copy its exact range and title into suggestedParentRange and suggestedParentTitle.',
                'A new category title must be short, reusable, and general enough for future notes, usually 1 to 5 words.',
                'Do not paraphrase the current note, copy a quote, or mirror a rare phrase from the draft as the category name.',
                'If a reusable new category title is not clear, return manual_review instead of inventing one.',
                'selectedMasterRange must be the exact top-level range that contains the chosen existing category or chosen host range.',
                'If rejectedSuggestion exists, avoid repeating the same category or host range unless it is still clearly the best fit.',
                'Keep reasoning to one short sentence.',
                'confidence must be a number between 0 and 1.',
                'Leave suggestedNewCategoryRange and suggestedCardAddress empty because the app generates numbers deterministically.',
                'Return only the filing decision fields required by the schema.',
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(context),
            },
          ],
        },
      ],
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'second_mind_card_filing_core_suggestion',
          description: 'A fast filing decision for a draft Second Mind card.',
          strict: true,
          schema: coreSuggestionSchema,
        },
      },
      max_output_tokens: tokenBudget,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'AI core filing request failed');
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error('AI returned no core filing suggestion');
  }

  try {
    return JSON.parse(outputText);
  } catch (error) {
    if (attempt < 1) {
      console.warn(`[AI] core filing parse retry after malformed JSON (${error instanceof Error ? error.message : 'unknown parse error'})`);
      return requestCoreFilingSuggestionWithRetry(context, attempt + 1);
    }

    throw new Error(error instanceof Error ? error.message : 'AI returned malformed core filing JSON');
  }
}

async function requestTopLevelRangeSelection(body) {
  return requestTopLevelRangeSelectionWithRetry(body, 0);
}

async function requestTopLevelRangeSelectionWithRetry(body, attempt) {
  const context = prepareCoarseFilingContext(body);
  const tokenBudget = attempt === 0 ? 80 : 120;

  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are the coarse filing router for Second Mind.',
                'Choose the one or two most likely top-level categories for this draft so a detailed filing pass can happen only inside those branches.',
                'Prefer one top-level category unless the draft genuinely spans two distinct areas.',
                'Use only ranges from availableTopLevelRanges.',
                'If the user rejected a previous filing suggestion, avoid returning the same master range unless it is still clearly the best fit.',
                'Do not pick leaf categories, addresses, cards, or new categories in this step.',
                'Use note function as well as topic. Idea seeds, book ideas, project ideas, analogies, and metaphors should prefer ideation or creativity branches when such branches exist.',
                'When note function conflicts with a literal noun, prefer note function if the evidence is clear.',
                'Base your choice on the note\'s function and topic using only the provided top-level categories.',
                'Return only the selected top-level ranges, a short reasoning note, and confidence.',
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(context),
            },
          ],
        },
      ],
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'second_mind_top_level_range_selection',
          description: 'One or two likely master ranges for a Second Mind draft.',
          strict: true,
          schema: filingRegionSelectionSchema,
        },
      },
      max_output_tokens: tokenBudget,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'AI top-level range selection request failed');
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error('AI returned no top-level range selection');
  }

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (error) {
    if (attempt < 1) {
      console.warn(`[AI] top-level range parse retry after malformed JSON (${error instanceof Error ? error.message : 'unknown parse error'})`);
      return requestTopLevelRangeSelectionWithRetry(body, attempt + 1);
    }

    throw new Error(error instanceof Error ? error.message : 'AI returned malformed top-level range JSON');
  }
  const availableTopLevelRanges = new Set(
    (context.availableTopLevelRanges || []).map(range => String(range.range || '').trim())
  );

  return Array.from(
    new Set(
      (Array.isArray(parsed.selectedTopLevelRanges) ? parsed.selectedTopLevelRanges : [])
        .map(range => String(range || '').trim())
        .filter(range => availableTopLevelRanges.has(range))
    )
  ).slice(0, 2);
}

async function requestCaptureStructuring(body) {
  const context = prepareSlimCaptureStructuringContext(body);
  const requestStartedAt = Date.now();

  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You structure rough Second Mind captures into clean card fields.',
                'Use localDraft as a first pass: keep what is correct, fix only what is clearly wrong, and do not duplicate source metadata inside suggestedContent.',
                'Preserve the actual note or quotation in suggestedContent.',
                'Move source clues into suggestedSource only when they are explicit or strongly implied.',
                'If the capture has no real source cues, keep suggestedSource.type as Other and leave source fields blank.',
                'Correct obvious source typos only at high confidence.',
                'When a canonical source title is clear, prefer the canonical title over the rough capture wording.',
                'For scripture, prefer the specific biblical book as the source title and use chapter:verse as the location when high confidence.',
                'Do not invent authors, page numbers, sections, timestamps, or verse references.',
                'suggestedTitle should be short, conceptual, and useful as a card handle.',
                'Prefer noun phrases, themes, principles, identities, tensions, or doctrines over sentence-like summaries.',
                'Leave suggestedTitle blank if a good conceptual handle is not clear.',
                'corrections should list only meaningful normalizations you actually made, such as a corrected book title or cleaned location.',
                'Return only the schema fields.',
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(context),
            },
          ],
        },
      ],
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'second_mind_capture_structuring',
          description: 'Structured card fields extracted from a rough Second Mind capture.',
          strict: true,
          schema: captureStructuringSchema,
        },
      },
      max_output_tokens: 180,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'AI capture structuring request failed');
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error('AI returned no structured capture result');
  }

  const result = JSON.parse(outputText);
  console.log(
    `[AI] structure-capture total=${Date.now() - requestStartedAt}ms contextBytes=${Buffer.byteLength(JSON.stringify(context), 'utf8')} chars=${String(body?.capture?.content || '').length}`
  );

  return result;
}

async function requestAskCardsAnswer(body) {
  const context = prepareAskCardsContext(body);

  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You answer questions for Second Mind using only the user-provided cards.',
                'Do not invent facts, card addresses, sources, or claims that are not supported by the cards.',
                'When the cards do not contain enough information, say so clearly and suggest what kind of card would answer it.',
                'Use referencedAddresses to cite only existing card addresses that directly support the answer.',
                'Keep the answer useful, concise, and written like a thoughtful research assistant.',
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(context),
            },
          ],
        },
      ],
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'second_mind_ask_cards_answer',
          description: 'An answer grounded in the user-provided Second Mind cards.',
          strict: true,
          schema: askCardsSchema,
        },
      },
      max_output_tokens: 1200,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'AI ask request failed');
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error('AI returned no structured answer');
  }

  return JSON.parse(outputText);
}

function prepareRejectedSuggestion(body) {
  return body?.rejectedSuggestion
    ? {
        mode: body.rejectedSuggestion.mode,
        categoryRange: body.rejectedSuggestion.suggestedCategoryRange,
        categoryTitle: body.rejectedSuggestion.suggestedCategoryTitle,
        parentRange: body.rejectedSuggestion.suggestedParentRange,
        parentTitle: body.rejectedSuggestion.suggestedParentTitle,
        newCategoryRange: body.rejectedSuggestion.suggestedNewCategoryRange,
        newCategoryTitle: body.rejectedSuggestion.suggestedNewCategoryTitle,
        reasoning: body.rejectedSuggestion.reasoning,
      }
    : null;
}

function isTopLevelRange(range) {
  const parsed = parseRange(range);
  return Boolean(parsed && parsed.start % 1000 === 0 && parsed.end === parsed.start + 999);
}

function isSubRange(range) {
  const parsed = parseRange(range);
  return Boolean(parsed && parsed.end === parsed.start + 99);
}

function rangeFallsWithin(range, parentRange) {
  const parsedRange = parseRange(range);
  const parsedParent = parseRange(parentRange);
  if (!parsedRange || !parsedParent) {
    return false;
  }

  return parsedRange.start >= parsedParent.start && parsedRange.end <= parsedParent.end;
}

function cardFallsWithinTopLevelRanges(card, selectedRanges) {
  const numericPrefix = Number.parseInt(String(card?.address || '').slice(0, 4), 10);
  if (Number.isNaN(numericPrefix)) {
    return false;
  }

  return selectedRanges.some(range => {
    const parsed = parseRange(range);
    return Boolean(parsed && numericPrefix >= parsed.start && numericPrefix <= parsed.end);
  });
}

function sortRanges(ranges) {
  return [...ranges].sort((a, b) => {
    const aStart = parseRange(a)?.start ?? Number.MAX_SAFE_INTEGER;
    const bStart = parseRange(b)?.start ?? Number.MAX_SAFE_INTEGER;
    return aStart - bStart;
  });
}

const FILING_STOPWORDS = new Set([
  'about',
  'after',
  'also',
  'and',
  'book',
  'card',
  'from',
  'have',
  'idea',
  'into',
  'just',
  'main',
  'note',
  'page',
  'quote',
  'that',
  'this',
  'with',
]);

function tokenizeFilingText(value) {
  return Array.from(
    new Set(
      String(value || '')
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter(token => !FILING_STOPWORDS.has(token)) || []
    )
  );
}

function buildDraftTokens(draft) {
  return tokenizeFilingText([
    draft?.address || '',
    draft?.title || '',
    draft?.content || '',
    Array.isArray(draft?.tags) ? draft.tags.join(' ') : '',
    draft?.source?.title || '',
    draft?.source?.author || '',
    draft?.source?.page || '',
    draft?.source?.url || '',
    draft?.source?.note || '',
  ].filter(Boolean).join(' '));
}

function scoreDraftMatch(draftTokens, values) {
  const haystack = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const token of draftTokens) {
    if (haystack.includes(token)) {
      score += token.length >= 7 ? 5 : 3;
    }
  }

  return score;
}

function scoreTopLevelRangesHeuristically(body) {
  const context = prepareCoarseFilingContext(body);
  const availableTopLevelRanges = Array.isArray(context.availableTopLevelRanges)
    ? context.availableTopLevelRanges
    : [];
  if (availableTopLevelRanges.length === 0) {
    return [];
  }

  const draft = body?.draft ?? {};
  const draftAddress = String(draft?.address || '').trim().toLowerCase();
  if (/^\d{4}[a-z]?$/.test(draftAddress)) {
    const numericPrefix = Number.parseInt(draftAddress.slice(0, 4), 10);
    const directMatch = availableTopLevelRanges.find(range => {
      const parsed = parseRange(range.range);
      return Boolean(parsed && numericPrefix >= parsed.start && numericPrefix <= parsed.end);
    });
    if (directMatch) {
      return [{ range: directMatch.range, score: Number.MAX_SAFE_INTEGER, index: 0 }];
    }
  }

  const draftTokens = buildDraftTokens(draft);
  const scoredRanges = availableTopLevelRanges.map((range, index) => {
    const score = scoreDraftMatch(
      draftTokens,
      [
        range.range,
        range.title || '',
        ...(Array.isArray(range.subranges)
          ? range.subranges.flatMap(subrange => [subrange.range, subrange.title || ''])
          : []),
      ]
    );
    return { range: range.range, score, index };
  });

  return scoredRanges
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function selectTopLevelRangesHeuristically(body) {
  const scoredRanges = scoreTopLevelRangesHeuristically(body);
  if (scoredRanges.length > 0) {
    return scoredRanges.slice(0, 2).map(entry => entry.range);
  }

  const context = prepareCoarseFilingContext(body);
  const availableTopLevelRanges = Array.isArray(context.availableTopLevelRanges)
    ? context.availableTopLevelRanges
    : [];
  return availableTopLevelRanges.slice(0, 1).map(range => range.range);
}

function selectMostRelevantItems(items, keySelector, scoreSelector, limit) {
  if (items.length <= limit) {
    return items;
  }

  const scoredItems = items.map((item, index) => ({
    item,
    index,
    score: scoreSelector(item),
  }));

  const selected = scoredItems
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(entry => entry.item);

  if (selected.length >= Math.min(limit, items.length)) {
    return selected;
  }

  const selectedKeys = new Set(selected.map(keySelector));
  const fallback = items
    .filter(item => !selectedKeys.has(keySelector(item)))
    .slice(0, limit - selected.length);

  return [...selected, ...fallback];
}

function prepareCoarseFilingContext(body) {
  const draft = body?.draft ?? {};
  const categories = Array.isArray(body?.categories) ? body.categories : [];
  const rangeCategories = categories.filter(category => typeof category.range === 'string' && category.range.includes('-'));
  const topLevelRanges = sortRanges(
    rangeCategories
      .filter(category => isTopLevelRange(category.range))
      .map(category => category.range)
  ).map(range => {
    const matchingCategory = rangeCategories.find(category => category.range === range);
    const subranges = sortRanges(
      rangeCategories
        .filter(category => isSubRange(category.range) && rangeFallsWithin(category.range, range))
        .map(category => category.range)
    ).map(subrange => {
      const matchingSubrange = rangeCategories.find(category => category.range === subrange);
      return {
        range: subrange,
        title: matchingSubrange?.title || '',
      };
    });

    return {
      range,
      title: matchingCategory?.title || '',
      subranges,
    };
  });

  return {
    task: 'Choose the one or two most likely master ranges for this draft so a detailed filing pass can happen inside them.',
    draft,
    rejectedSuggestion: prepareRejectedSuggestion(body),
    availableTopLevelRanges: topLevelRanges,
    outputRules: {
      chooseRanges: 'selectedTopLevelRanges must contain one or two master ranges from availableTopLevelRanges.',
      preferOne: 'Prefer one master range unless the draft genuinely spans two distinct areas.',
      avoidRejected: 'If rejectedSuggestion exists, avoid repeating its master range unless it is still clearly the best fit.',
    },
  };
}

function prepareSlimBranchFilingCoreContext(body, selectedTopLevelRanges = []) {
  const draft = body?.draft ?? {};
  const categories = Array.isArray(body?.categories) ? body.categories : [];
  const cards = Array.isArray(body?.cards) ? body.cards : [];
  const draftAddress = String(draft?.address || '').trim().toLowerCase();
  const draftTokens = buildDraftTokens(draft);
  const effectiveRanges = sortRanges(
    Array.from(
      new Set(
        selectedTopLevelRanges
          .map(range => String(range || '').trim())
          .filter(range => isTopLevelRange(range))
      )
    )
  );
  const narrowedRanges = effectiveRanges.length > 0
    ? effectiveRanges
    : sortRanges(
        categories
          .filter(category => typeof category.range === 'string' && isTopLevelRange(category.range))
          .map(category => category.range)
      ).slice(0, 1);

  const filteredCategories = categories.filter(category =>
    narrowedRanges.some(range => rangeFallsWithin(category.range, range))
  );
  const filteredCards = cards.filter(card => cardFallsWithinTopLevelRanges(card, narrowedRanges));
  const leafCategories = filteredCategories.filter(category => typeof category.range === 'string' && !category.range.includes('-'));
  const newCategoryRanges = filteredCategories.filter(category => typeof category.range === 'string' && isSubRange(category.range));

  const masterRangeCandidates = narrowedRanges.map(range => {
    const matchingRange = categories.find(category => category.range === range);
    return {
      range,
      title: matchingRange?.title || '',
      clue: matchingRange?.title || '',
      score: scoreDraftMatch(draftTokens, [range, matchingRange?.title || '']),
    };
  });

  const leafCandidates = selectMostRelevantItems(
    leafCategories,
    category => category.id || category.range,
    category => {
      let score = scoreDraftMatch(draftTokens, [category.range, category.title || '']);
      if (draftAddress && /^\d{4}[a-z]?$/.test(draftAddress) && draftAddress.startsWith(String(category.range || '').toLowerCase())) {
        score += 10;
      }
      return score;
    },
    6
  ).map(category => {
    const parentRange = narrowedRanges.find(range => rangeFallsWithin(category.range, range)) || '';
    const matchingParent = categories.find(candidate => candidate.range === parentRange);
    const supportingCards = filteredCards.filter(card => String(card.address || '').toLowerCase().startsWith(String(category.range || '').toLowerCase()));
    const bestSupportingCard = supportingCards
      .map(card => ({
        card,
        score: scoreDraftMatch(draftTokens, [
          card.title,
          truncate(card.content || '', 120),
          Array.isArray(card.tags) ? card.tags.join(' ') : '',
          card.source?.title || '',
        ]),
      }))
      .sort((first, second) => second.score - first.score)[0]?.card;
    const score = scoreDraftMatch(draftTokens, [category.range, category.title || '']) +
      supportingCards.reduce((sum, card) => sum + Math.min(6, scoreDraftMatch(draftTokens, [
        card.title,
        truncate(card.content || '', 120),
        Array.isArray(card.tags) ? card.tags.join(' ') : '',
        card.source?.title || '',
      ])), 0);

    return {
      id: String(category.id || ''),
      range: String(category.range || ''),
      title: String(category.title || ''),
      parentRange,
      parentTitle: matchingParent?.title || '',
      nextCardAddress: getNextCardAddress(String(category.range || ''), cards),
      clue: bestSupportingCard ? `${bestSupportingCard.address} ${bestSupportingCard.title}` : String(category.title || ''),
      score,
    };
  });

  const newCategoryCandidates = selectMostRelevantItems(
    newCategoryRanges,
    category => category.id || category.range,
    category => scoreDraftMatch(draftTokens, [category.range, category.title || '']),
    3
  ).map(category => {
    const parentRange = narrowedRanges.find(range => rangeFallsWithin(category.range, range)) || '';
    const matchingParent = categories.find(candidate => candidate.range === parentRange);
    const childLeafs = leafCategories.filter(candidate => rangeFallsWithin(candidate.range, category.range)).slice(0, 10);
    const score = scoreDraftMatch(draftTokens, [category.range, category.title || '']) +
      childLeafs.reduce((sum, child) => sum + Math.min(5, scoreDraftMatch(draftTokens, [child.range, child.title || ''])), 0);

    return {
      parentRange,
      parentTitle: matchingParent?.title || '',
      hostRange: String(category.range || ''),
      hostTitle: String(category.title || ''),
      suggestedRange: getNextCategoryAddress(String(category.range || ''), categories),
      suggestedTitleHint: String(category.title || ''),
      clue: String(category.title || ''),
      score,
    };
  });

  return {
    task: 'Choose the best filing destination from the provided master ranges and category candidates.',
    draft: {
      address: String(draft?.address || ''),
      title: String(draft?.title || ''),
      content: truncate(String(draft?.content || ''), 220),
      tags: Array.isArray(draft?.tags) ? draft.tags.slice(0, 4) : [],
      source: {
        type: String(draft?.source?.type || 'Other'),
        title: String(draft?.source?.title || ''),
        author: String(draft?.source?.author || ''),
        page: String(draft?.source?.page || ''),
      },
    },
    rejectedSuggestion: prepareRejectedSuggestion(body),
    semanticHints: Array.isArray(body?.semanticHints) ? body.semanticHints.slice(0, 4).map(String) : [],
    masterRangeCandidates,
    leafCandidates,
    newCategoryCandidates,
    outputRules: {
      masterRange: 'selectedMasterRange must match one of masterRangeCandidates.range and selectedMasterRangeTitle must match that candidate title.',
      existingLeaf: 'For mode existing_category, choose exactly one leaf candidate and copy its id, range, and title into the response. Leave suggestedCardAddress empty because the app will generate it.',
      newLeaf: 'For mode new_category, choose exactly one newCategoryCandidate and copy its hostRange into suggestedParentRange and its hostTitle into suggestedParentTitle. Do not invent numeric category addresses.',
      manualReview: 'Use manual_review only when the draft is genuinely too thin or the candidates are all weak.',
      precision: 'Return empty strings for fields that do not apply to the chosen mode.',
    },
  };
}

function sanitizeAiCategoryNode(node) {
  const children = Array.isArray(node?.children) ? node.children.map(sanitizeAiCategoryNode) : [];
  return {
    id: String(node?.id || ''),
    range: String(node?.range || ''),
    title: String(node?.title || ''),
    isLeaf: Boolean(node?.isLeaf),
    children,
  };
}

function buildTopLevelCategoriesFromFlat(categories) {
  const normalized = (Array.isArray(categories) ? categories : [])
    .filter(category => typeof category?.range === 'string' && typeof category?.title === 'string')
    .map(category => ({
      id: String(category.id || category.range || ''),
      range: String(category.range || ''),
      title: String(category.title || ''),
      isLeaf: Boolean(category.isLeaf),
      children: [],
    }));

  const nodesByRange = new Map(normalized.map(category => [category.range, category]));
  const rootRanges = [];

  const findParentRange = range => {
    const candidateRanges = normalized
      .filter(candidate => candidate.range !== range && candidate.range.includes('-') && rangeFallsWithin(range, candidate.range))
      .sort((first, second) => {
        const firstParsed = parseRange(first.range);
        const secondParsed = parseRange(second.range);
        const firstSpan = firstParsed ? firstParsed.end - firstParsed.start : Number.MAX_SAFE_INTEGER;
        const secondSpan = secondParsed ? secondParsed.end - secondParsed.start : Number.MAX_SAFE_INTEGER;
        return firstSpan - secondSpan;
      });

    return candidateRanges[0]?.range || '';
  };

  for (const category of normalized) {
    const parentRange = findParentRange(category.range);
    if (parentRange && nodesByRange.has(parentRange)) {
      nodesByRange.get(parentRange).children.push(category);
      continue;
    }

    if (isTopLevelRange(category.range)) {
      rootRanges.push(category);
    }
  }

  const sortNode = node => ({
    ...node,
    children: node.children
      .sort((first, second) => {
        const firstStart = parseRange(first.range)?.start ?? Number.parseInt(first.range, 10) ?? Number.MAX_SAFE_INTEGER;
        const secondStart = parseRange(second.range)?.start ?? Number.parseInt(second.range, 10) ?? Number.MAX_SAFE_INTEGER;
        return firstStart - secondStart;
      })
      .map(sortNode),
  });

  return rootRanges
    .sort((first, second) => (parseRange(first.range)?.start ?? 0) - (parseRange(second.range)?.start ?? 0))
    .map(sortNode);
}

function prepareTaxonomyAgnosticFilingContext(body) {
  const draft = body?.draft ?? {};
  const topLevelCategories = Array.isArray(body?.topLevelCategories) && body.topLevelCategories.length > 0
    ? body.topLevelCategories.map(sanitizeAiCategoryNode)
    : buildTopLevelCategoriesFromFlat(body?.categories);

  return {
    task: 'Choose the best filing destination inside the provided category tree.',
    draft: {
      address: String(draft?.address || ''),
      title: String(draft?.title || ''),
      content: truncate(String(draft?.content || ''), 320),
      tags: Array.isArray(draft?.tags) ? draft.tags.slice(0, 5).map(String) : [],
      source: {
        type: String(draft?.source?.type || 'Other'),
        title: String(draft?.source?.title || ''),
        author: String(draft?.source?.author || ''),
        page: String(draft?.source?.page || ''),
      },
    },
    rejectedSuggestion: prepareRejectedSuggestion(body),
    semanticHints: Array.isArray(body?.semanticHints) ? body.semanticHints.slice(0, 5).map(String) : [],
    topLevelCategories,
    outputRules: {
      taxonomyOnly: 'Use only categories from topLevelCategories. Do not assume any default taxonomy beyond what is provided here.',
      existingCategory: 'For mode existing_category, choose an existing leaf node and copy its exact id, range, and title.',
      newCategory: 'For mode new_category, choose a non-leaf host node and copy its exact range and title into suggestedParentRange and suggestedParentTitle.',
      reusableShelf: 'suggestedNewCategoryTitle must be a reusable shelf name, not a paraphrase of the current note.',
      manualReview: 'Use manual_review when the note is too thin, the fit is ambiguous, or no reusable new category title is clear.',
      precision: 'Return empty strings for fields that do not apply to the chosen mode, and keep confidence between 0 and 1.',
    },
  };
}

function prepareSlimFilingCoreContext(body) {
  return prepareTaxonomyAgnosticFilingContext(body);
}

function buildFullSuggestionFromCore(coreSuggestion, draft) {
  return {
    ...coreSuggestion,
    suggestedTitle: '',
    suggestedContent: '',
    suggestedTags: [],
    suggestedStatus: 'Seed',
    suggestedRelatedAddresses: [],
    suggestedSource: {
      type: String(draft?.source?.type || 'Other'),
      title: String(draft?.source?.title || ''),
      author: String(draft?.source?.author || ''),
      url: String(draft?.source?.url || ''),
      page: String(draft?.source?.page || ''),
      note: String(draft?.source?.note || ''),
    },
    corrections: [],
  };
}

function prepareSlimCaptureStructuringContext(body) {
  const capture = body?.capture ?? {};
  const localDraft = body?.localDraft ?? {};

  return {
    task: 'Turn this rough capture into clean card fields while preserving the note body and moving source details out of the body.',
    capture: {
      title: String(capture.title || ''),
      content: String(capture.content || ''),
      sourceText: String(capture.sourceText || ''),
    },
    localDraft: {
      suggestedTitle: String(localDraft.suggestedTitle || ''),
      suggestedContent: String(localDraft.suggestedContent || ''),
      suggestedSource: {
        type: String(localDraft.suggestedSource?.type || 'Other'),
        title: String(localDraft.suggestedSource?.title || ''),
        author: String(localDraft.suggestedSource?.author || ''),
        url: String(localDraft.suggestedSource?.url || ''),
        page: String(localDraft.suggestedSource?.page || ''),
        note: String(localDraft.suggestedSource?.note || ''),
      },
      corrections: Array.isArray(localDraft.corrections) ? localDraft.corrections.slice(0, 4).map(String) : [],
      confidence: Number(localDraft.confidence || 0),
    },
    outputRules: {
      noteBody: 'suggestedContent should contain only the note, quote, or idea itself.',
      sourceFields: 'Use suggestedSource only for explicit or high-confidence source data.',
      location: 'Use suggestedSource.page for the best precise locator available, but leave it blank if you are not highly confident.',
      title: 'suggestedTitle should be a short conceptual handle. Leave it blank if a good handle is not clear.',
      corrections: 'Only list real normalizations you actually made.',
      restraint: 'Do not invent missing source data.',
    },
  };
}

function prepareCaptureStructuringContext(body) {
  const capture = body?.capture ?? {};
  const heuristic = body?.heuristic ?? {};

  return {
    task: 'Turn this rough capture into a cleaner card draft by separating note content from source details.',
    capture: {
      title: String(capture.title || ''),
      content: String(capture.content || ''),
      sourceText: String(capture.sourceText || ''),
    },
    heuristicDraft: {
      suggestedTitle: String(heuristic.suggestedTitle || ''),
      suggestedContent: String(heuristic.suggestedContent || ''),
      suggestedSource: {
        type: String(heuristic.suggestedSource?.type || ''),
        title: String(heuristic.suggestedSource?.title || ''),
        author: String(heuristic.suggestedSource?.author || ''),
        url: String(heuristic.suggestedSource?.url || ''),
        page: String(heuristic.suggestedSource?.page || ''),
        note: String(heuristic.suggestedSource?.note || ''),
      },
    },
    outputRules: {
      noteContent: 'suggestedContent should contain only the note body: the quote, paraphrase, or idea itself.',
      sourceFields: 'Put source metadata in suggestedSource only when it is explicit or strongly implied by the capture.',
      originalNotes: 'If the capture does not indicate a source, keep suggestedSource as blank fields with type Other.',
      locationField: 'Use suggestedSource.page for the best precise locator available for that source type. Fill it when explicit or recoverable with high confidence from the source and note text; otherwise leave it blank.',
      scriptureSource: 'For scripture, prefer the specific biblical book as title and do not use Bible as a generic author.',
      workingTitle: 'Use suggestedTitle only when a short conceptual handle is clear. Prefer the core idea over a literal quote summary.',
      blankSource: 'If no real source details are present, use type Other and leave the rest blank.',
    },
  };
}

function prepareAskCardsContext(body) {
  const question = String(body?.question || '').trim();
  const cards = Array.isArray(body?.cards) ? body.cards : [];
  const categories = Array.isArray(body?.categories) ? body.categories : [];

  return {
    task: 'Answer the question using only these cards. Cite the most relevant card addresses.',
    question,
    categories: categories.slice(0, 260).map(category => ({
      range: category.range,
      title: category.title || '',
    })),
    cards: cards.slice(0, 350).map(card => ({
      address: card.address,
      title: card.title,
      content: truncate(card.content || '', 1200),
      status: card.status || '',
      tags: card.tags || [],
      relatedAddresses: card.relatedAddresses || [],
      source: {
        type: card.source?.type || '',
        title: card.source?.title || '',
        author: card.source?.author || '',
        url: card.source?.url || '',
        page: card.source?.page || '',
      },
    })),
    outputRules: {
      answer: 'Synthesize across cards where possible, but stay grounded in card text.',
      references: 'referencedAddresses must contain only addresses from the provided cards.',
      insufficientEvidence: 'If the answer is not in the cards, say that directly and keep referencedAddresses empty.',
      followUps: 'suggestedFollowUps should be short questions the user might ask next.',
    },
  };
}

function parseRange(range) {
  if (!range.includes('-')) {
    const value = Number.parseInt(range, 10);
    return Number.isNaN(value) ? null : { start: value, end: value };
  }

  const [rawStart, rawEnd] = range.split('-');
  const start = Number.parseInt(rawStart, 10);
  const end = Number.parseInt(rawEnd, 10);
  return Number.isNaN(start) || Number.isNaN(end) ? null : { start, end };
}

function getNextCardAddress(categoryRange, cards) {
  const prefix = String(categoryRange || '').trim().toLowerCase().padStart(4, '0').slice(0, 4);
  const existingLetters = cards
    .map(card => String(card.address || '').trim().toLowerCase())
    .filter(address => new RegExp(`^${prefix}[a-z]$`).test(address))
    .map(address => address[prefix.length])
    .sort();

  if (existingLetters.length === 0) {
    return `${prefix}a`;
  }

  return `${prefix}${String.fromCharCode(existingLetters[existingLetters.length - 1].charCodeAt(0) + 1)}`;
}

function getNextCategoryAddress(range, categories) {
  const parsedRange = parseRange(range);
  if (!parsedRange) {
    return '';
  }

  const usedNumbers = new Set(
    categories
      .map(category => String(category.range || '').trim().toLowerCase())
      .filter(address => /^\d{4}$/.test(address))
      .map(address => Number.parseInt(address, 10))
  );
  const firstCandidate = parsedRange.start % 100 === 0 ? parsedRange.start + 1 : parsedRange.start;

  for (let candidate = firstCandidate; candidate <= parsedRange.end; candidate += 1) {
    if (!usedNumbers.has(candidate)) {
      return String(candidate).padStart(4, '0');
    }
  }

  return '';
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
}
