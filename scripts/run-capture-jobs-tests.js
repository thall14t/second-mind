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
    buildLocalClassificationFallback,
    buildCaptureProcessingJobViews,
    buildCaptureProcessingLabel,
    getCaptureJobStatusLabel,
    getInboxCaptureStructuredDraft,
    inboxCaptureIsReadyToFile,
  } = require(path.join(buildDir, 'utils', 'captureJobs.js'));

  return {
    buildClassificationLocalSignals,
    buildLocalClassificationFallback,
    buildCaptureProcessingJobViews,
    buildCaptureProcessingLabel,
    getCaptureJobStatusLabel,
    getInboxCaptureStructuredDraft,
    inboxCaptureIsReadyToFile,
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
    buildLocalClassificationFallback,
    buildCaptureProcessingJobViews,
    buildCaptureProcessingLabel,
    getCaptureJobStatusLabel,
    getInboxCaptureStructuredDraft,
    inboxCaptureIsReadyToFile,
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

  const todoFallback = buildLocalClassificationFallback({
    bulletLineCount: 2,
    numberedLineCount: 1,
    hasSourceCues: false,
    looksLikeQuote: false,
  });
  assert.strictEqual(todoFallback.route, 'todo');

  const clarifyFallback = buildLocalClassificationFallback({
    bulletLineCount: 0,
    numberedLineCount: 0,
    hasSourceCues: false,
    looksLikeQuote: false,
  });
  assert.strictEqual(clarifyFallback.needsClarification, true);

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

  console.log('All capture job utils tests passed.');
}

runTests();