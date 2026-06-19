const assert = require('assert');
const {
  buildUserOverrideClassification,
  normalizeClassificationResult,
  normalizeEnrichResult,
  normalizeTodoGenerationResult,
  prepareClassifyCaptureContext,
  prepareGenerateTodosContext,
  toConfidenceBand,
} = require('../server/captureRouting');

function runTests() {
  assert.strictEqual(toConfidenceBand(0.9), 'high');
  assert.strictEqual(toConfidenceBand(0.6), 'medium');
  assert.strictEqual(toConfidenceBand(0.2), 'low');

  const override = buildUserOverrideClassification('todo');
  assert.strictEqual(override.route, 'todo');
  assert.strictEqual(override.needsClarification, false);
  assert.strictEqual(buildUserOverrideClassification(null), null);

  const classified = normalizeClassificationResult({
    route: 'card',
    confidence: 0.4,
    reasoning: 'Reads like a quote.',
    needsClarification: false,
    alternatives: [
      { route: 'todo', confidence: 0.2, reasoning: 'Could be one task.' },
    ],
  });
  assert.strictEqual(classified.confidenceBand, 'low');
  assert.strictEqual(classified.needsClarification, false);
  assert.strictEqual(classified.confidenceBand, 'low');

  const suppressedPrompt = normalizeClassificationResult({
    route: 'card',
    confidence: 0.4,
    reasoning: 'Unclear.',
    needsClarification: true,
    clarificationPrompt: 'Library or tasks?',
  });
  assert.strictEqual(suppressedPrompt.needsClarification, false);

  const needsPrompt = normalizeClassificationResult({
    route: 'card',
    confidence: 0.28,
    reasoning: 'Could be either.',
    needsClarification: true,
    clarificationPrompt: 'Library or tasks?',
    alternatives: [
      { route: 'todo', confidence: 0.26, reasoning: 'Could also be errands.' },
    ],
  });
  assert.strictEqual(needsPrompt.needsClarification, true);
  assert.ok(needsPrompt.clarificationPrompt);

  const enriched = normalizeEnrichResult({
    suggestedTitle: 'Grace',
    suggestedContent: 'Saved by grace.',
    suggestedSource: { type: 'Book', title: 'Romans', author: '', url: '', page: '3:23', note: '' },
    corrections: ['Normalized book title'],
    confidence: 0.82,
  });
  assert.strictEqual(enriched.strategy, 'ai');
  assert.strictEqual(enriched.confidenceBand, 'high');

  const classifyContext = prepareClassifyCaptureContext({
    capture: { title: 'Errands', content: '- milk\n- eggs' },
    hints: {
      localSignals: {
        bulletLineCount: 2,
        numberedLineCount: 0,
        hasSourceCues: false,
        looksLikeQuote: false,
      },
    },
  });
  assert.strictEqual(classifyContext.hints.localSignals.bulletLineCount, 2);

  const generateContext = prepareGenerateTodosContext({
    capture: { title: 'Project', content: '- draft outline\n- email editor' },
    heuristicHints: {
      todos: [
        { clientId: 'parent', title: 'Project', sortOrder: 0, parentId: null },
        { clientId: 'child', title: 'draft outline', sortOrder: 0, parentId: 'parent' },
      ],
      confidence: 'low',
      note: 'test hints',
    },
    context: {
      existingCardAddresses: ['0102a', 'bad', '0102a'],
    },
  });
  assert.deepStrictEqual(generateContext.context.existingCardAddresses, ['0102a', 'bad']);
  assert.strictEqual(generateContext.heuristicHints.confidence, 'low');
  assert.match(generateContext.outputRules.heuristicHints, /blindly/i);
  assert.ok(Array.isArray(generateContext.examples));

  const appendContext = prepareGenerateTodosContext({
    capture: { title: '', content: 'Add wipe counters to house chores' },
    localDraft: { todos: [] },
    context: {
      existingTodos: [
        { clientId: 'house-root', title: 'House chores', parentClientId: null, sortOrder: 0, completed: false },
        { clientId: 'child-1', title: 'Vacuum living room', parentClientId: 'house-root', sortOrder: 0, completed: false },
      ],
    },
  });
  assert.strictEqual(appendContext.context.existingTodos.length, 2);
  assert.strictEqual(appendContext.context.existingTodos[0].clientId, 'house-root');
  assert.match(appendContext.outputRules.appendToExistingList, /parentClientId/);

  const generated = normalizeTodoGenerationResult(
    {
      todos: [
        { clientId: 'parent', title: 'Project', parentClientId: '', sortOrder: 0 },
        {
          clientId: 'child',
          title: 'Draft outline',
          parentClientId: 'parent',
          sortOrder: 0,
          relatedAddresses: ['0102a', '9999z'],
        },
      ],
      corrections: [],
      confidence: 0.77,
    },
    { context: { existingCardAddresses: ['0102a'] } }
  );
  assert.strictEqual(generated.todos.length, 2);
  assert.strictEqual(generated.todos[1].parentClientId, 'parent');
  assert.deepStrictEqual(generated.todos[1].relatedAddresses, ['0102a']);
  assert.strictEqual(generated.confidenceBand, 'medium');

  const sanitizedGarden = normalizeTodoGenerationResult(
    {
      todos: [
        {
          clientId: 'parent',
          title: 'Finish the garden including installing the gate door, placing headers, and trimming posts.',
          parentClientId: '',
          sortOrder: 0,
        },
        {
          clientId: 'child-1',
          title: 'Install the gate door',
          parentClientId: 'parent',
          sortOrder: 0,
        },
      ],
      corrections: [],
      confidence: 0.8,
    },
    {
      capture: {
        title: '',
        content: 'Finish the garden including installing the gate door, placing headers, and trimming posts.',
      },
    }
  );
  assert.strictEqual(sanitizedGarden.todos[0].title, 'Finish the garden');

  const clarifying = normalizeTodoGenerationResult(
    {
      todos: [{ clientId: 'root', title: 'Laundry', parentClientId: '', sortOrder: 0 }],
      corrections: [],
      confidence: 0.7,
      needsClarification: true,
      clarificationPrompt: 'When do guests arrive?',
      inputType: 'free_text',
    },
    {}
  );
  assert.strictEqual(clarifying.needsClarification, true);
  assert.strictEqual(clarifying.clarificationPrompt, 'When do guests arrive?');
  assert.strictEqual(clarifying.inputType, 'free_text');

  const clarificationContext = prepareGenerateTodosContext({
    capture: { title: 'Laundry', content: 'Do before guests arrive' },
    localDraft: { todos: [] },
    clarification: {
      round: 2,
      answers: [{
        stage: 'generate_todos',
        prompt: 'When do guests arrive?',
        answer: 'Saturday afternoon',
      }],
      partialTodos: [{ clientId: 'root', title: 'Laundry', parentClientId: '', sortOrder: 0 }],
    },
  });
  assert.strictEqual(clarificationContext.clarification.answers.length, 1);
  assert.match(clarificationContext.outputRules.dueDates, /preserve the phrase in todo content/);
  assert.match(clarificationContext.outputRules.clarification, /materially improve/);

  console.log('All capture routing server tests passed.');
}

runTests();