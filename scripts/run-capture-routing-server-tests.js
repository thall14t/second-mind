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

  const needsPrompt = normalizeClassificationResult({
    route: 'card',
    confidence: 0.4,
    reasoning: 'Unclear.',
    needsClarification: true,
    clarificationPrompt: 'Library or tasks?',
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
    localDraft: {
      todos: [
        { clientId: 'parent', title: 'Project', sortOrder: 0, parentId: null },
        { clientId: 'child', title: 'draft outline', sortOrder: 0, parentId: 'parent' },
      ],
    },
    context: {
      existingCardAddresses: ['0102a', 'bad', '0102a'],
    },
  });
  assert.deepStrictEqual(generateContext.context.existingCardAddresses, ['0102a', 'bad']);

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

  console.log('All capture routing server tests passed.');
}

runTests();