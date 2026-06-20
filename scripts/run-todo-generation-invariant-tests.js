const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.join(__dirname, '.tmp-todo-generation-invariant-tests');

const MULTI_PROJECT_CAPTURE = {
  title: '',
  content:
    'I need to do the garden including installing the gate, trimming the posts, and placing the headers. '
    + 'I need to finish the walk-in including putting up trim and patching holes. '
    + 'I need to build the built in bookcase including planning the build, buying the wood, and staining the trim.',
};

const GARDEN_CAPTURE = {
  title: '',
  content: 'Finish the garden including installing the gate door, placing headers, and trimming posts.',
};

function compileModules() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const tscCommand = process.platform === 'win32'
    ? path.join(appRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(appRoot, 'node_modules', '.bin', 'tsc');
  const result = spawnSync(tscCommand, [
    path.join(appRoot, 'utils', 'todoGenerationInvariants.ts'),
    path.join(appRoot, 'utils', 'todoGenerationSanitize.ts'),
    path.join(appRoot, 'utils', 'todoTaskTitles.ts'),
    path.join(appRoot, 'utils', 'todoParsing.ts'),
    path.join(appRoot, 'utils', 'captureJobs.ts'),
    path.join(appRoot, 'utils', 'todoDates.ts'),
    path.join(appRoot, 'utils', 'todoAppend.ts'),
    path.join(appRoot, 'utils', 'todoTree.ts'),
    path.join(appRoot, 'types.ts'),
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--outDir', buildDir,
  ], {
    cwd: appRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    console.error(result.stdout || result.stderr);
    throw new Error('Failed to compile todo generation invariant tests.');
  }
}

function loadModules() {
  const {
    applyTodoGenerationInvariants,
    assertTodoTreeMeetsInvariants,
    TODO_GENERATION_INVARIANT_CODES,
  } = require(path.join(buildDir, 'utils', 'todoGenerationInvariants.js'));
  const { sanitizeTodoGeneration } = require(path.join(buildDir, 'utils', 'todoGenerationSanitize.js'));
  const { parseTodosFromCapture } = require(path.join(buildDir, 'utils', 'todoParsing.js'));
  const { mapTodosToGenerationDrafts } = require(path.join(buildDir, 'utils', 'captureJobs.js'));
  const { sanitizeTodoGeneration: sanitizeJs } = require(path.join(appRoot, 'server', 'todoGenerationSanitize.js'));
  const {
    applyTodoGenerationInvariants: applyJs,
    TODO_GENERATION_INVARIANT_CODES: CODES_JS,
  } = require(path.join(appRoot, 'server', 'todoGenerationInvariants.js'));

  return {
    applyTodoGenerationInvariants,
    assertTodoTreeMeetsInvariants,
    TODO_GENERATION_INVARIANT_CODES,
    sanitizeTodoGeneration,
    sanitizeJs,
    applyJs,
    CODES_JS,
    parseTodosFromCapture,
    mapTodosToGenerationDrafts,
  };
}

function runScenario(name, capture, drafts, expectations, helpers) {
  const sanitized = helpers.sanitizeTodoGeneration(capture, {
    strategy: 'ai',
    todos: drafts,
  });
  const failures = helpers.assertTodoTreeMeetsInvariants(capture, sanitized.todos, expectations);
  assert.strictEqual(
    failures.length,
    0,
    `${name} invariant failures:\n- ${failures.join('\n- ')}`
  );
}

function runTests() {
  compileModules();
  const helpers = loadModules();

  assert.deepStrictEqual(
    helpers.TODO_GENERATION_INVARIANT_CODES,
    helpers.CODES_JS,
    'TS and server invariant codes must stay aligned.'
  );

  const badGardenParent = {
    strategy: 'ai',
    todos: [
      { clientId: 'parent', title: GARDEN_CAPTURE.content, parentClientId: null, sortOrder: 0 },
      { clientId: 'child-1', title: 'putting up trim', parentClientId: 'parent', sortOrder: 0 },
      { clientId: 'child-2', title: 'Trimming posts', parentClientId: 'parent', sortOrder: 1 },
    ],
  };

  runScenario(
    'ai-bad-garden-parent',
    GARDEN_CAPTURE,
    badGardenParent.todos,
    {
      noParentIncluding: true,
      noCaptureEchoParents: true,
      noGerundChildren: true,
      noInvalidParentRefs: true,
    },
    helpers
  );

  const sanitizedGarden = helpers.sanitizeTodoGeneration(GARDEN_CAPTURE, badGardenParent);
  assert.strictEqual(sanitizedGarden.todos[0].title, 'Finish the garden');
  assert.strictEqual(sanitizedGarden.todos[1].title, 'Put up trim');
  assert.strictEqual(sanitizedGarden.todos[2].title, 'Trim posts');

  const sanitizedGardenJs = helpers.sanitizeJs(GARDEN_CAPTURE, badGardenParent);
  assert.strictEqual(sanitizedGardenJs.todos[0].title, 'Finish the garden');

  const localTodos = helpers.parseTodosFromCapture(
    MULTI_PROJECT_CAPTURE.title,
    MULTI_PROJECT_CAPTURE.content
  );
  const localDrafts = helpers.mapTodosToGenerationDrafts(localTodos);
  const sanitizedLocal = helpers.sanitizeTodoGeneration(MULTI_PROJECT_CAPTURE, {
    strategy: 'local',
    todos: localDrafts,
  });

  const localFailures = helpers.assertTodoTreeMeetsInvariants(MULTI_PROJECT_CAPTURE, sanitizedLocal.todos, {
    minRoots: 3,
    noParentIncluding: true,
    noCaptureEchoParents: true,
    noGerundChildren: true,
    noInvalidParentRefs: true,
  });
  assert.strictEqual(localFailures.length, 0, localFailures.join(' '));

  const orphanDrafts = [
    { clientId: 'child', title: 'Patch holes', parentClientId: 'missing-parent', sortOrder: 0 },
  ];
  const repaired = helpers.applyTodoGenerationInvariants(GARDEN_CAPTURE, {
    strategy: 'ai',
    todos: orphanDrafts,
  });
  assert.strictEqual(repaired.todos[0].parentClientId, null);
  assert.match((repaired.corrections ?? []).join(' '), /missing parent/i);

  const repairedJs = helpers.applyJs(GARDEN_CAPTURE, {
    strategy: 'ai',
    todos: orphanDrafts,
  });
  assert.strictEqual(repairedJs.todos[0].parentClientId, null);

  console.log(JSON.stringify({
    ok: true,
    scenarios: [
      'ai-bad-garden-parent',
      'local-multi-project-fallback',
      'orphan-parent-ref-repair',
      'ts-server-parity',
    ],
    invariantCodes: Object.values(helpers.TODO_GENERATION_INVARIANT_CODES),
  }, null, 2));
}

try {
  runTests();
} catch (error) {
  console.error(error);
  process.exit(1);
}