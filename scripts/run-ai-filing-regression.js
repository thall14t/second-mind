const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Phase 0 wrap-up note: Expand this harness for Phase 1+ to cover todo generation, event extraction, and assistant flows across cards + todos + events.

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.join(__dirname, '.tmp-ai-filing-regression');

function compileRegressionModules() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const args = [
    path.join(appRoot, 'utils', 'aiCataloguing.ts'),
    path.join(appRoot, 'utils', 'aiFiling.ts'),
    path.join(appRoot, 'utils', 'antinet.ts'),
    path.join(appRoot, 'types.ts'),
    path.join(appRoot, 'data', 'antinetCategories.ts'),
    path.join(appRoot, 'data', 'testCards.ts'),
    '--module',
    'commonjs',
    '--target',
    'es2020',
    '--moduleResolution',
    'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--outDir',
    buildDir,
  ];

  const tscCommand = process.platform === 'win32'
    ? path.join(appRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(appRoot, 'node_modules', '.bin', 'tsc');
  const result = spawnSync(tscCommand, args, {
    cwd: appRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to compile regression modules.\nerror=${result.error?.message || 'none'}\n${result.stdout || ''}\n${result.stderr || ''}`,
    );
  }
}

function loadCompiledModules() {
  const aiCataloguing = require(path.join(buildDir, 'utils', 'aiCataloguing.js'));
  const aiFiling = require(path.join(buildDir, 'utils', 'aiFiling.js'));
  const antinetUtils = require(path.join(buildDir, 'utils', 'antinet.js'));
  const antinetCategoriesModule = require(path.join(buildDir, 'data', 'antinetCategories.js'));
  const testCardsModule = require(path.join(buildDir, 'data', 'testCards.js'));

  return {
    aiCataloguing,
    aiFiling,
    antinetUtils,
    antinetCategories: antinetCategoriesModule.antinetCategories || antinetCategoriesModule.default,
    testCards: testCardsModule.testCards || testCardsModule.default,
  };
}

function buildDraft(content, extra = {}) {
  return {
    address: '',
    title: '',
    content,
    tags: [],
    source: { type: 'Other', title: '', author: '', url: '', page: '', note: '' },
    ...extra,
  };
}

function hasLeafNode(nodes) {
  for (const node of nodes || []) {
    if (node.isLeaf) {
      return true;
    }
    if (hasLeafNode(node.children || [])) {
      return true;
    }
  }
  return false;
}

function summarizePlan(plan) {
  return {
    note: plan.quickSuggestion.reasoning,
    mode: plan.quickSuggestion.mode,
    master: plan.quickSuggestion.selectedMasterRange,
    category: plan.quickSuggestion.suggestedCategoryTitle || plan.quickSuggestion.suggestedNewCategoryTitle,
    confidence: plan.quickSuggestion.confidence,
    shouldUseAi: plan.shouldUseAi,
  };
}

function run() {
  compileRegressionModules();
  const {
    aiCataloguing,
    aiFiling,
    antinetUtils,
    antinetCategories,
    testCards,
  } = loadCompiledModules();

  const customCategories = [
    {
      id: '4101',
      range: '4101',
      title: 'Cultural Elites',
      parentId: '4100-4199',
      createdAt: '2026-04-28T00:00:00.000Z',
      isCustom: true,
      isLeaf: true,
    },
    {
      id: '7401',
      range: '7401',
      title: 'Book Concepts',
      parentId: '7400-7499',
      createdAt: '2026-04-28T00:00:00.000Z',
      isCustom: true,
      isLeaf: true,
    },
    {
      id: '9005',
      range: '9005',
      title: 'Life Metaphors',
      parentId: '9000-9099',
      createdAt: '2026-04-28T00:00:00.000Z',
      isCustom: true,
      isLeaf: true,
    },
    {
      id: '8901',
      range: '8901',
      title: 'Imitation Learning',
      parentId: '8900-8999',
      createdAt: '2026-04-28T00:00:00.000Z',
      isCustom: true,
      isLeaf: true,
    },
  ];

  const categoryTree = antinetUtils.buildCategoryTree(antinetCategories, customCategories, [], []);
  const allCategories = antinetUtils.flattenCategories(categoryTree);
  const cards = testCards.map(antinetUtils.normalizeCard);

  const localOriginalDraft = buildDraft(
    'The category of emergency expands whenever convenience is treated as necessity.'
  );
  const localOriginalPlan = aiCataloguing.buildFilingPlan({
    draft: localOriginalDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.strictEqual(localOriginalPlan.shouldUseAi, false, 'Short unsourced conceptual note should stay local-first.');
  assert.strictEqual(localOriginalPlan.quickSuggestion.mode, 'existing_category', 'Local-first conceptual note should land on an existing category.');

  const sourcedDraft = buildDraft(
    'Luke 18 8 when the Son of Man comes will he find faith on earth.'
  );
  const sourcedPlan = aiCataloguing.buildFilingPlan({
    draft: sourcedDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.notStrictEqual(
    sourcedPlan.quickSuggestion.mode,
    'manual_review',
    'Scripture-like sourced note should still resolve to a concrete local filing suggestion.'
  );

  const timeoutCandidateDrafts = [
    buildDraft('The internet made imitation cheaper than apprenticeship.'),
    buildDraft('A museum is a machine for controlling what a society remembers publicly.'),
    buildDraft('The archive of a civilization reveals what it feared losing, not just what it loved.'),
    buildDraft('A market can be efficient in price and still corrupt in what it rewards.'),
  ];
  const timeoutCandidate = timeoutCandidateDrafts
    .map(draft => ({
      draft,
      plan: aiCataloguing.buildFilingPlan({
        draft,
        categories: allCategories,
        cards,
        editingCardId: null,
        rejectedSuggestion: null,
      }),
    }))
    .find(entry => entry.plan.shouldUseAi && entry.plan.quickSuggestion.mode !== 'manual_review');

  assert.ok(timeoutCandidate, 'Regression pool should contain at least one AI-first draft with a usable local shelf fallback.');
  const timeoutDraft = timeoutCandidate.draft;
  const timeoutPlan = timeoutCandidate.plan;

  const timedOutFallback = aiFiling.buildTimedOutLocalFilingFallbackSuggestion({
    draft: timeoutDraft,
    filingPlan: timeoutPlan,
    allCategories,
    cards,
    editingCardId: null,
  });
  assert.notStrictEqual(timedOutFallback.mode, 'manual_review', 'AI timeout should fall back to the strongest local shelf when available.');
  assert.strictEqual(timedOutFallback.confidenceBand, 'medium', 'AI timeout fallback should be marked as moderate confidence.');

  const creativeDraft = buildDraft(
    'Book idea where each chapter explores a vice through a different room in a house.'
  );
  const creativePlan = aiCataloguing.buildFilingPlan({
    draft: creativeDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  const creativePlanV2 = aiCataloguing.buildFilingPlanV2({
    draft: creativeDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.notStrictEqual(
    creativePlanV2.quickSuggestion.suggestedCategoryTitle,
    'Life Metaphors',
    'V2 book-idea notes should not be reduced to a generic metaphor shelf when a literary shelf exists.'
  );
  assert.ok(
    ['Book Concepts', 'Book Ideas'].includes(creativePlanV2.quickSuggestion.suggestedCategoryTitle || creativePlanV2.quickSuggestion.suggestedNewCategoryTitle || ''),
    'V2 book-idea notes should prefer an authored-work shelf when one exists.'
  );
  assert.ok(
    ['7000-7999', '9800-9899'].includes(creativePlanV2.quickSuggestion.selectedMasterRange || ''),
    'V2 should resolve book-idea notes into a creative or authored-work branch.'
  );
  const payload = aiFiling.buildAiAssistPayload({
    draft: creativeDraft,
    semanticHints: creativePlanV2.payload.semanticHints || [],
    filingPlan: creativePlanV2,
    categoryTree,
    allCategories,
  });

  const novelStructureDraft = buildDraft(
    'How to structure a novel using garden metaphors.'
  );
  const novelStructurePlanV2 = aiCataloguing.buildFilingPlanV2({
    draft: novelStructureDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.ok(
    ['7000-7999', '9800-9899'].includes(novelStructurePlanV2.quickSuggestion.selectedMasterRange || ''),
    'V2 should prefer a creative branch for novel-structuring notes even when garden language is present.'
  );

  const creativeMetaphorDraft = buildDraft(
    'Metaphor for a future book: a family inherits a greenhouse that only blooms when someone tells the truth.'
  );
  const creativeMetaphorPlanV2 = aiCataloguing.buildFilingPlanV2({
    draft: creativeMetaphorDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.ok(
    ['7000-7999', '9800-9899'].includes(creativeMetaphorPlanV2.quickSuggestion.selectedMasterRange || ''),
    'V2 should treat creative-framing metaphors as idea seeds rather than practical notes.'
  );

  const practicalGardenDraft = buildDraft(
    'Milk and water in a spray bottle fights powdery mildew.'
  );
  const practicalGardenPlanV2 = aiCataloguing.buildFilingPlanV2({
    draft: practicalGardenDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.ok(
    ['9000-9999', '9900-9999'].includes(practicalGardenPlanV2.quickSuggestion.selectedMasterRange || ''),
    'V2 should keep practical garden remedies in the practical branches.'
  );

  const conceptDraft = buildDraft(
    'Every institution trains attention before it teaches doctrine.'
  );
  const conceptPlanV2 = aiCataloguing.buildFilingPlanV2({
    draft: conceptDraft,
    categories: allCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.ok(
    conceptPlanV2.quickSuggestion.mode !== 'manual_review',
    'V2 should still handle ordinary concept notes without collapsing to manual review.'
  );

  const customTaxonomyCategories = [
    {
      id: '8301',
      range: '8301',
      title: 'Writing Lab',
      parentId: '8300-8399',
      createdAt: '2026-04-28T00:00:00.000Z',
      isCustom: true,
      isLeaf: true,
    },
    {
      id: '9905',
      range: '9905',
      title: 'Garden Remedies',
      parentId: '9900-9999',
      createdAt: '2026-04-28T00:00:00.000Z',
      isCustom: true,
      isLeaf: true,
    },
  ];
  const customTaxonomyTree = antinetUtils.buildCategoryTree(antinetCategories, customTaxonomyCategories, [], []);
  const customTaxonomyAllCategories = antinetUtils.flattenCategories(customTaxonomyTree);
  const customTaxonomyCreativePlanV2 = aiCataloguing.buildFilingPlanV2({
    draft: creativeDraft,
    categories: customTaxonomyAllCategories,
    cards,
    editingCardId: null,
    rejectedSuggestion: null,
  });
  assert.ok(
    ['7000-7999', '8000-8999', '9800-9899'].includes(customTaxonomyCreativePlanV2.quickSuggestion.selectedMasterRange || ''),
    'V2 should still prefer a creative or authored-work branch under a customized taxonomy.'
  );

  assert.strictEqual(payload.topLevelCategories.length, categoryTree.length, 'Payload should always include every top-level range.');
  const selectedMasterRange = creativePlanV2.quickSuggestion.selectedMasterRange;
  const selectedMasterNode = payload.topLevelCategories.find(node => node.range === selectedMasterRange);
  assert.ok(selectedMasterNode, 'Payload should include the selected master range branch.');
  assert.ok((selectedMasterNode.children || []).length > 0, 'Selected master range branch should retain filing context children.');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'local-original-note-fast-path',
      'sourced-note-resolves-to-shelf',
      'timeout-falls-back-to-local-shelf',
      'book-idea-v2-beats-v1',
      'novel-structure-prefers-creative-branch',
      'creative-metaphor-prefers-idea-seed-branch',
      'practical-garden-stays-practical',
      'custom-taxonomy-still-prefers-creative-branch',
      'payload-retains-selected-branch-context',
    ],
    samples: {
      localOriginal: {
        shouldUseAi: localOriginalPlan.shouldUseAi,
        category: localOriginalPlan.quickSuggestion.suggestedCategoryTitle,
      },
      timeoutFallback: {
        capture: timeoutDraft.content,
        mode: timedOutFallback.mode,
        category: timedOutFallback.suggestedCategoryTitle || timedOutFallback.suggestedNewCategoryTitle,
        confidenceBand: timedOutFallback.confidenceBand,
      },
      creativeIdea: {
        v1: summarizePlan(creativePlan),
        v2: summarizePlan(creativePlanV2),
      },
      novelStructure: summarizePlan(novelStructurePlanV2),
      creativeMetaphor: summarizePlan(creativeMetaphorPlanV2),
      practicalGarden: summarizePlan(practicalGardenPlanV2),
      conceptNote: summarizePlan(conceptPlanV2),
      customTaxonomyCreative: summarizePlan(customTaxonomyCreativePlanV2),
      noteFunctions: {
        bookIdea: aiCataloguing.classifyNoteFunction(creativeDraft),
        novelStructure: aiCataloguing.classifyNoteFunction(novelStructureDraft),
        practicalGarden: aiCataloguing.classifyNoteFunction(practicalGardenDraft),
      },
      payloadRoots: payload.topLevelCategories.length,
      payloadSelectedBranch: selectedMasterRange,
    },
  }, null, 2));
}

run();
