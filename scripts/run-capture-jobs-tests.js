const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.join(__dirname, '.tmp-capture-jobs-tests');

function compileModules() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const args = [
    path.join(appRoot, 'utils', 'captureJobs.ts'),
    path.join(appRoot, 'types.ts'),
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
    console.error(result.stdout || result.stderr);
    throw new Error('Failed to compile capture job utils for tests.');
  }
}

function loadModules() {
  const {
    buildClassificationLocalSignals,
    createCaptureJob,
    getActiveProcessingJobs,
    mapTodoGenerationToTodos,
    mapTodosToGenerationDrafts,
    pruneCaptureJobs,
    upsertCaptureJob,
    applyEnrichmentToCapture,
    buildAiUnavailableClassificationFallback,
    buildLocalClassificationFallback,
    finalizeCaptureClassification,
    inferObviousCaptureRoute,
    buildUserOverrideClassification,
    buildCaptureProcessingJobViews,
    buildCaptureProcessingLabel,
    getCaptureJobStatusLabel,
    getInboxCaptureStructuredDraft,
    inboxCaptureIsReadyToFile,
    captureEnrichmentHasMeaningfulWork,
    getInboxCaptureDisplayStatus,
    getInboxCaptureDisplayTitle,
    getInboxCaptureStatusLabel,
    buildCaptureClarificationViews,
    buildCaptureClarificationLabel,
  } = require(path.join(buildDir, 'utils', 'captureJobs.js'));

  return {
    buildClassificationLocalSignals,
    buildAiUnavailableClassificationFallback,
    buildLocalClassificationFallback,
    finalizeCaptureClassification,
    inferObviousCaptureRoute,
    buildUserOverrideClassification,
    buildCaptureProcessingJobViews,
    buildCaptureProcessingLabel,
    getCaptureJobStatusLabel,
    getInboxCaptureStructuredDraft,
    inboxCaptureIsReadyToFile,
    captureEnrichmentHasMeaningfulWork,
    getInboxCaptureDisplayStatus,
    getInboxCaptureDisplayTitle,
    getInboxCaptureStatusLabel,
    buildCaptureClarificationViews,
    buildCaptureClarificationLabel,
    createCaptureJob,
    getActiveProcessingJobs,
    mapTodoGenerationToTodos,
    mapTodosToGenerationDrafts,
    pruneCaptureJobs,
    upsertCaptureJob,
    applyEnrichmentToCapture,
  };
}

function runTests() {
  compileModules();
  const {
    buildClassificationLocalSignals,
    createCaptureJob,
    getActiveProcessingJobs,
    mapTodoGenerationToTodos,
    mapTodosToGenerationDrafts,
    pruneCaptureJobs,
    upsertCaptureJob,
    applyEnrichmentToCapture,
    buildAiUnavailableClassificationFallback,
    buildLocalClassificationFallback,
    finalizeCaptureClassification,
    inferObviousCaptureRoute,
    buildUserOverrideClassification,
    buildCaptureProcessingJobViews,
    buildCaptureProcessingLabel,
    getCaptureJobStatusLabel,
    getInboxCaptureStructuredDraft,
    inboxCaptureIsReadyToFile,
    captureEnrichmentHasMeaningfulWork,
    getInboxCaptureDisplayStatus,
    getInboxCaptureDisplayTitle,
    getInboxCaptureStatusLabel,
    buildCaptureClarificationViews,
    buildCaptureClarificationLabel,
  } = loadModules();

  const signals = buildClassificationLocalSignals('', '- buy milk\n- call dentist\n1. finish report');
  assert.strictEqual(signals.bulletLineCount, 2);
  assert.strictEqual(signals.numberedLineCount, 1);

  const quoteSignals = buildClassificationLocalSignals('Note', '"The truth will set you free."');
  assert.strictEqual(quoteSignals.looksLikeQuote, true);

  const job = createCaptureJob('capture-1');
  assert.strictEqual(job.status, 'pending');
  assert.strictEqual(job.captureId, 'capture-1');

  const active = getActiveProcessingJobs([
    job,
    { ...job, id: 'job-2', status: 'completed' },
    { ...job, id: 'job-3', status: 'classifying' },
  ]);
  assert.strictEqual(active.length, 2);

  const todos = mapTodoGenerationToTodos([
    { clientId: 'parent', title: 'Parent', sortOrder: 0, parentClientId: null },
    { clientId: 'child', title: 'Child', sortOrder: 0, parentClientId: 'parent' },
  ], 1000);
  assert.strictEqual(todos.length, 2);
  assert.strictEqual(todos[1].parentId, todos[0].id);

  const roundTrip = mapTodosToGenerationDrafts(todos);
  assert.strictEqual(roundTrip[1].parentClientId, roundTrip[0].clientId);

  const pruned = pruneCaptureJobs(
    [
      { ...job, id: 'done', status: 'completed' },
      { ...job, id: 'waiting', status: 'awaiting_clarification' },
    ],
    []
  );
  assert.strictEqual(pruned.length, 1);
  assert.strictEqual(pruned[0].status, 'awaiting_clarification');

  const upserted = upsertCaptureJob([], job);
  assert.strictEqual(upserted.length, 1);

  const todoFallback = buildLocalClassificationFallback(
    'Errands',
    '- milk\n- eggs\n1. bread',
    { bulletLineCount: 2, numberedLineCount: 1, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(todoFallback.route, 'todo');

  const callTask = inferObviousCaptureRoute(
    '',
    'Call dentist to reschedule',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(callTask?.route, 'todo');

  const aphorismCard = inferObviousCaptureRoute(
    '',
    'our lord is love',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(aphorismCard?.route, 'card');
  assert.strictEqual(aphorismCard?.needsClarification, false);

  const jeepTodo = inferObviousCaptureRoute(
    '',
    'I need to fix jeep by this sunday including oil change and tire rotation',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(jeepTodo?.route, 'todo');
  assert.strictEqual(jeepTodo?.needsClarification, false);

  const houseChores = inferObviousCaptureRoute(
    'House chores',
    'vacuum living room\ndo dishes\nfold laundry\ntake out trash',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(houseChores?.route, 'todo');
  assert.strictEqual(houseChores?.needsClarification, false);

  const plainChoreLines = inferObviousCaptureRoute(
    '',
    'mop kitchen\nwater plants\nempty dishwasher',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(plainChoreLines?.route, 'todo');

  const commaErrands = inferObviousCaptureRoute(
    '',
    'pick up prescription, grab dog food, mail package at post office',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(commaErrands?.route, 'todo');

  const appendToList = inferObviousCaptureRoute(
    '',
    'Add wipe counters to house chores',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(appendToList?.route, 'todo');
  assert.strictEqual(appendToList?.needsClarification, false);

  const override = buildUserOverrideClassification('todo');
  assert.strictEqual(override.needsClarification, false);

  const clarifyFallback = buildLocalClassificationFallback(
    '',
    'maybe',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(clarifyFallback.needsClarification, true);

  const aiUnavailable = buildAiUnavailableClassificationFallback(
    'maybe',
    'something vague',
    { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false }
  );
  assert.strictEqual(aiUnavailable.needsClarification, false);

  const suppressedClarification = finalizeCaptureClassification({
    route: 'card',
    confidence: 0.58,
    confidenceBand: 'medium',
    reasoning: 'Leans card but cautious.',
    needsClarification: true,
  });
  assert.strictEqual(suppressedClarification.needsClarification, false);

  const keptClarification = finalizeCaptureClassification({
    route: 'card',
    confidence: 0.28,
    confidenceBand: 'low',
    reasoning: 'Could be either.',
    needsClarification: true,
    alternatives: [
      { route: 'todo', confidence: 0.26, reasoning: 'Could also be errands.' },
    ],
  });
  assert.strictEqual(keptClarification.needsClarification, true);

  assert.strictEqual(buildCaptureProcessingLabel(2), 'Processing 2 captures');
  assert.strictEqual(getCaptureJobStatusLabel('classifying'), 'Classifying');

  const views = buildCaptureProcessingJobViews(
    [
      { ...job, id: 'job-active', status: 'enriching' },
      { ...job, id: 'job-done', status: 'completed' },
    ],
    [{ id: 'capture-1', title: 'Garden idea', content: 'Plant tomatoes', createdAt: '2026-01-01T00:00:00.000Z' }]
  );
  assert.strictEqual(views.length, 1);
  assert.strictEqual(views[0].previewTitle, 'Garden idea');

  const enriched = applyEnrichmentToCapture(
    { id: 'cap-1', title: 'T', content: 'Body', createdAt: '2026-01-01T00:00:00.000Z' },
    { suggestedTitle: 'Title', suggestedContent: 'Body', strategy: 'local' },
    'job-1'
  );
  assert.strictEqual(enriched.intendedType, 'card');
  assert.strictEqual(enriched.enrichment?.jobId, 'job-1');
  assert.strictEqual(getInboxCaptureStructuredDraft(enriched)?.suggestedTitle, 'Title');
  assert.strictEqual(inboxCaptureIsReadyToFile(enriched), true);
  assert.strictEqual(inboxCaptureIsReadyToFile({ id: 'raw', title: 'T', content: 'Body', createdAt: '2026-01-01T00:00:00.000Z' }), false);

  assert.strictEqual(
    captureEnrichmentHasMeaningfulWork(
      { title: 'T', content: 'Body' },
      { suggestedTitle: 'T', suggestedContent: 'Body', strategy: 'local' }
    ),
    false
  );
  assert.strictEqual(
    captureEnrichmentHasMeaningfulWork(
      { title: 'T', content: 'Body' },
      { suggestedTitle: 'Title', suggestedContent: 'Body', strategy: 'local' }
    ),
    true
  );
  assert.strictEqual(
    captureEnrichmentHasMeaningfulWork(
      { title: 'Quote', content: 'our lord is love' },
      { suggestedTitle: 'Quote', suggestedContent: 'our lord is love', strategy: 'ai' }
    ),
    true
  );
  assert.strictEqual(getInboxCaptureDisplayTitle(enriched), 'Title');
  assert.strictEqual(getInboxCaptureDisplayStatus(enriched), 'ready_to_file');
  assert.strictEqual(getInboxCaptureStatusLabel('ready_to_file'), 'Ready to file');
  assert.strictEqual(
    getInboxCaptureDisplayStatus(
      { id: 'raw', title: 'T', content: 'Body', createdAt: '2026-01-01T00:00:00.000Z' },
      { ...job, status: 'classifying' }
    ),
    'processing'
  );

  const clarificationViews = buildCaptureClarificationViews(
    [{
      ...job,
      id: 'clarify-job',
      status: 'awaiting_clarification',
      classification: {
        route: 'card',
        confidence: 0.2,
        confidenceBand: 'low',
        reasoning: 'Ambiguous',
        needsClarification: true,
        clarificationPrompt: 'Library note or errands?',
      },
    }],
    [{ id: 'capture-1', title: 'Maybe tasks', content: 'Call someone', createdAt: '2026-01-01T00:00:00.000Z' }]
  );
  assert.strictEqual(clarificationViews.length, 1);
  assert.strictEqual(clarificationViews[0].prompt, 'Library note or errands?');
  assert.strictEqual(buildCaptureClarificationLabel(2), '2 captures need your input');

  console.log('All capture job utils tests passed.');
}

runTests();