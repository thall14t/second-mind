const captureClassificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['route', 'confidence', 'reasoning', 'needsClarification'],
  properties: {
    route: { type: 'string', enum: ['card', 'todo'] },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
    needsClarification: { type: 'boolean' },
    clarificationPrompt: { type: 'string' },
    alternatives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['route', 'confidence', 'reasoning'],
        properties: {
          route: { type: 'string', enum: ['card', 'todo'] },
          confidence: { type: 'number' },
          reasoning: { type: 'string' },
        },
      },
    },
  },
};

const todoGenerationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['todos', 'corrections', 'confidence'],
  properties: {
    todos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clientId', 'title', 'parentClientId', 'sortOrder'],
        properties: {
          clientId: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          parentClientId: { type: 'string' },
          sortOrder: { type: 'number' },
          dueDate: { type: 'string' },
          relatedAddresses: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    corrections: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
};

function toConfidenceBand(confidence) {
  const value = Number(confidence);
  if (value >= 0.8) {
    return 'high';
  }
  if (value >= 0.55) {
    return 'medium';
  }
  return 'low';
}

function prepareClassifyCaptureContext(body) {
  const capture = body?.capture ?? {};
  const hints = body?.hints ?? {};
  const localSignals = hints.localSignals ?? {};

  return {
    task: 'Classify whether this rough capture should become a library card note or a structured todo list.',
    capture: {
      title: String(capture.title || ''),
      content: String(capture.content || ''),
      sourceText: String(capture.sourceText || ''),
    },
    hints: {
      userOverride: hints.userOverride ?? null,
      localSignals: {
        bulletLineCount: Number(localSignals.bulletLineCount || 0),
        numberedLineCount: Number(localSignals.numberedLineCount || 0),
        hasSourceCues: Boolean(localSignals.hasSourceCues),
        looksLikeQuote: Boolean(localSignals.looksLikeQuote),
      },
    },
    routingRules: {
      cardSignals: [
        'quoted or paraphrased prose tied to a source',
        'conceptual claim, aphorism, or idea seed',
        'source cues such as author, URL, page, or scripture reference',
      ],
      todoSignals: [
        'multiple bullet or numbered action lines',
        'multiple plain action lines without bullets, such as vacuum, do dishes, fold laundry',
        'comma-separated errand lists on one line',
        'titles or framing such as chores, house chores, errands, checklist, or cleaning list',
        'imperative task language such as buy, call, finish, schedule',
        'need to, have to, or must with an action and optional deadline',
        'including subtasks such as oil change and tire rotation',
        'explicit list framing such as todo, tasks, errands, or before Friday',
        'append phrasing such as add wipe counters to house chores or add X to that list',
      ],
      cardSignalsExtra: [
        'short spiritual or aphoristic declarations such as our lord is love',
        'conceptual noun-phrase claims without actionable verbs',
      ],
      ambiguousCases: [
        'single short line that could be either a card title or one-item todo',
        'mixed paragraph plus a few bullets without clear dominance',
      ],
      clarification: 'Set needsClarification true ONLY when you truly cannot decide between card and todo. Low confidence alone is not enough.',
      authority: 'You are the authoritative routing step. Read the capture text directly. localSignals are weak hints only.',
      output: 'Return route card or todo. Do not structure fields or invent tasks beyond what the capture implies.',
    },
  };
}

function prepareGenerateTodosContext(body) {
  const capture = body?.capture ?? {};
  const localDraft = body?.localDraft ?? {};
  const context = body?.context ?? {};
  const allowedAddresses = new Set(
    (Array.isArray(context.existingCardAddresses) ? context.existingCardAddresses : [])
      .map(address => String(address || '').trim())
      .filter(Boolean)
      .slice(0, 50)
  );
  const existingTodos = (Array.isArray(context.existingTodos) ? context.existingTodos : [])
    .slice(0, 80)
    .map((todo, index) => ({
      clientId: String(todo?.clientId || todo?.id || `existing-${index}`),
      title: String(todo?.title || '').trim(),
      parentClientId: String(todo?.parentClientId || todo?.parentId || '').trim() || null,
      sortOrder: Number.isFinite(Number(todo?.sortOrder)) ? Number(todo.sortOrder) : index,
      completed: Boolean(todo?.completed),
    }))
    .filter(todo => todo.title);

  return {
    task: 'Turn this rough capture into a structured nestable todo tree.',
    capture: {
      title: String(capture.title || ''),
      content: String(capture.content || ''),
      sourceText: String(capture.sourceText || ''),
    },
    localDraft: {
      todos: (Array.isArray(localDraft.todos) ? localDraft.todos : []).slice(0, 40).map((todo, index) => ({
        clientId: String(todo.clientId || todo.id || `local-${index}`),
        title: String(todo.title || ''),
        content: String(todo.content || ''),
        parentClientId: String(todo.parentClientId || todo.parentId || ''),
        sortOrder: Number.isFinite(Number(todo.sortOrder)) ? Number(todo.sortOrder) : index,
        dueDate: String(todo.dueDate || ''),
        relatedAddresses: Array.isArray(todo.relatedAddresses)
          ? todo.relatedAddresses.map(String).slice(0, 8)
          : [],
      })),
      strategy: 'local',
    },
    context: {
      existingCardAddresses: Array.from(allowedAddresses),
      existingTodos,
    },
    outputRules: {
      authority: 'You are the authoritative todo generation step. Build the todo tree directly from capture text. localDraft may be empty.',
      nesting: 'Preserve parent and child structure using clientId and parentClientId. Use an empty parentClientId for root todos.',
      appendToExistingList: 'When the capture adds one or more tasks to an existing list (e.g. "add wipe counters to house chores" or "add X to that list"), return ONLY the new todos. Set each new todo parentClientId to the matching existing parent clientId from context.existingTodos. Do not recreate the parent list or duplicate existing children.',
      dueDates: 'Infer dueDate only when explicit or strongly implied. Use YYYY-MM-DD.',
      relatedAddresses: 'Set relatedAddresses only when the capture clearly references one of the provided existing card addresses.',
      restraint: 'Improve titles and grouping, but do not invent tasks the capture does not imply.',
      flattening: 'Do not flatten a real list into one todo unless the capture truly has one item.',
      clientIds: 'Return stable clientId values for every todo.',
    },
  };
}

function buildUserOverrideClassification(userOverride) {
  if (userOverride !== 'card' && userOverride !== 'todo') {
    return null;
  }

  return {
    route: userOverride,
    confidence: 1,
    confidenceBand: 'high',
    reasoning: 'User chose the capture route after clarification.',
    needsClarification: false,
    alternatives: [],
  };
}

const CLASSIFICATION_CLARIFICATION_MAX_CONFIDENCE = 0.42;

function normalizeClassificationResult(raw) {
  const route = raw?.route === 'todo' ? 'todo' : 'card';
  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence ?? 0)));
  const confidenceBand = toConfidenceBand(confidence);
  const alternatives = (Array.isArray(raw?.alternatives) ? raw.alternatives : [])
    .map(alternative => ({
      route: alternative?.route === 'todo' ? 'todo' : 'card',
      confidence: Math.max(0, Math.min(1, Number(alternative?.confidence ?? 0))),
      reasoning: String(alternative?.reasoning || '').trim(),
    }))
    .filter(alternative => alternative.reasoning)
    .slice(0, 2);

  let needsClarification = Boolean(raw?.needsClarification);

  if (needsClarification && confidence >= CLASSIFICATION_CLARIFICATION_MAX_CONFIDENCE) {
    needsClarification = false;
  }

  if (needsClarification && confidence >= 0.3) {
    const hasCloseAlternative = alternatives.some(
      alternative => Math.abs(alternative.confidence - confidence) <= 0.12
    );
    if (!hasCloseAlternative) {
      needsClarification = false;
    }
  }

  return {
    route,
    confidence,
    confidenceBand,
    reasoning: String(raw?.reasoning || '').trim() || 'No reasoning provided.',
    alternatives,
    needsClarification,
    clarificationPrompt: needsClarification
      ? String(raw?.clarificationPrompt || '').trim() || 'Is this a note for your library or a task list?'
      : undefined,
  };
}

function normalizeEnrichResult(raw, body) {
  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence ?? 0)));
  const allowedAddresses = new Set(
    (Array.isArray(body?.context?.existingCards) ? body.context.existingCards : [])
      .map(card => String(card?.address || '').trim())
      .filter(Boolean)
  );

  const relatedAddresses = (Array.isArray(raw?.suggestedRelatedAddresses) ? raw.suggestedRelatedAddresses : [])
    .map(address => String(address || '').trim())
    .filter(address => allowedAddresses.size === 0 || allowedAddresses.has(address))
    .slice(0, 8);

  return {
    suggestedTitle: String(raw?.suggestedTitle || ''),
    suggestedContent: String(raw?.suggestedContent || ''),
    suggestedSource: {
      type: ['Web', 'Book', 'Article', 'Video', 'Other'].includes(raw?.suggestedSource?.type)
        ? raw.suggestedSource.type
        : 'Other',
      title: String(raw?.suggestedSource?.title || ''),
      author: String(raw?.suggestedSource?.author || ''),
      url: String(raw?.suggestedSource?.url || ''),
      page: String(raw?.suggestedSource?.page || ''),
      note: String(raw?.suggestedSource?.note || ''),
    },
    suggestedTags: (Array.isArray(raw?.suggestedTags) ? raw.suggestedTags : [])
      .map(String)
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 8),
    suggestedStatus: ['Seed', 'Growing', 'Evergreen'].includes(raw?.suggestedStatus)
      ? raw.suggestedStatus
      : 'Seed',
    suggestedRelatedAddresses: relatedAddresses,
    corrections: Array.isArray(raw?.corrections)
      ? raw.corrections.map(String).filter(Boolean).slice(0, 6)
      : [],
    confidence,
    confidenceBand: toConfidenceBand(confidence),
    strategy: 'ai',
  };
}

function normalizeTodoGenerationResult(raw, body) {
  const allowedAddresses = new Set(
    (Array.isArray(body?.context?.existingCardAddresses) ? body.context.existingCardAddresses : [])
      .map(address => String(address || '').trim())
      .filter(Boolean)
  );
  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence ?? 0)));

  const todos = (Array.isArray(raw?.todos) ? raw.todos : [])
    .map((todo, index) => {
      const parentClientId = String(todo?.parentClientId || '').trim();
      const relatedAddresses = (Array.isArray(todo?.relatedAddresses) ? todo.relatedAddresses : [])
        .map(address => String(address || '').trim())
        .filter(address => allowedAddresses.has(address));

      return {
        clientId: String(todo?.clientId || `todo-${index}`),
        title: String(todo?.title || '').trim(),
        content: String(todo?.content || '').trim() || undefined,
        parentClientId: parentClientId || null,
        sortOrder: Number.isFinite(Number(todo?.sortOrder)) ? Number(todo.sortOrder) : index,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(todo?.dueDate || ''))
          ? String(todo.dueDate)
          : undefined,
        relatedAddresses: relatedAddresses.length > 0 ? relatedAddresses : undefined,
      };
    })
    .filter(todo => todo.title);

  return {
    todos,
    corrections: Array.isArray(raw?.corrections)
      ? raw.corrections.map(String).filter(Boolean).slice(0, 6)
      : [],
    confidence,
    confidenceBand: toConfidenceBand(confidence),
    strategy: 'ai',
  };
}

async function requestClassifyCapture(body, deps) {
  const override = buildUserOverrideClassification(body?.hints?.userOverride);
  if (override) {
    return override;
  }

  const context = prepareClassifyCaptureContext(body);
  const requestStartedAt = Date.now();

  const response = await deps.fetch(deps.responsesUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: deps.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You classify rough Second Mind captures as either card or todo routes.',
                'Card means a durable library note, quote, idea, or source-backed thought.',
                'Todo means actionable tasks, errands, checklists, or project steps.',
                'You are the authoritative routing step. Read the capture text directly.',
                'Use localSignals as weak hints only; never let them override clear capture text.',
                'Set needsClarification true ONLY when you truly cannot decide between card and todo.',
                'If you can lean toward either route, return that route with needsClarification false even when confidence is moderate.',
                'Low confidence alone is NOT a reason to ask for clarification.',
                'Do not structure card fields or generate final todos in this step.',
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
          name: 'second_mind_capture_classification',
          description: 'Route decision for a rough Second Mind capture.',
          strict: true,
          schema: captureClassificationSchema,
        },
      },
      max_output_tokens: 140,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'AI capture classification request failed');
  }

  const outputText = deps.extractOutputText(data);
  if (!outputText) {
    throw new Error('AI returned no capture classification result');
  }

  const parsed = JSON.parse(outputText);
  const result = normalizeClassificationResult(parsed);
  console.log(
    `[AI] classify-capture total=${Date.now() - requestStartedAt}ms route=${result.route} band=${result.confidenceBand} chars=${String(body?.capture?.content || '').length}`
  );

  return result;
}

async function requestEnrichCardCapture(body, requestCaptureStructuring) {
  const raw = await requestCaptureStructuring(body);
  return normalizeEnrichResult(raw, body);
}

async function requestGenerateTodos(body, deps) {
  const context = prepareGenerateTodosContext(body);
  const requestStartedAt = Date.now();

  const response = await deps.fetch(deps.responsesUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: deps.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You generate structured nestable todos from rough Second Mind captures.',
                'You are the authoritative structuring step. Build the todo tree directly from capture text.',
                'localDraft may be empty; do not depend on it. Improve titles, nesting, due dates, and card links yourself.',
                'Return clientId and parentClientId for every todo. Use an empty parentClientId for root todos.',
                'Only set relatedAddresses when the capture clearly references one of the provided existing card addresses.',
                'Infer dueDate only when explicit or strongly implied, using YYYY-MM-DD.',
                'Do not invent tasks the capture does not imply.',
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
          name: 'second_mind_todo_generation',
          description: 'Structured nestable todos generated from a rough capture.',
          strict: true,
          schema: todoGenerationSchema,
        },
      },
      max_output_tokens: 420,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'AI todo generation request failed');
  }

  const outputText = deps.extractOutputText(data);
  if (!outputText) {
    throw new Error('AI returned no todo generation result');
  }

  const parsed = JSON.parse(outputText);
  const result = normalizeTodoGenerationResult(parsed, body);
  console.log(
    `[AI] generate-todos total=${Date.now() - requestStartedAt}ms todos=${result.todos.length} chars=${String(body?.capture?.content || '').length}`
  );

  return result;
}

module.exports = {
  captureClassificationSchema,
  todoGenerationSchema,
  toConfidenceBand,
  prepareClassifyCaptureContext,
  prepareGenerateTodosContext,
  buildUserOverrideClassification,
  normalizeClassificationResult,
  normalizeEnrichResult,
  normalizeTodoGenerationResult,
  requestClassifyCapture,
  requestEnrichCardCapture,
  requestGenerateTodos,
};