const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.join(__dirname, '.tmp-todo-generation-sanitize-tests');

function compileModules() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const tscCommand = process.platform === 'win32'
    ? path.join(appRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(appRoot, 'node_modules', '.bin', 'tsc');
  const result = spawnSync(tscCommand, [
    path.join(appRoot, 'utils', 'todoGenerationSanitize.ts'),
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
    throw new Error('Failed to compile todo generation sanitize tests.');
  }
}

function runTests() {
  compileModules();
  const { sanitizeTodoGeneration } = require(path.join(buildDir, 'utils', 'todoGenerationSanitize.js'));
  const { sanitizeTodoGeneration: sanitizeJs } = require(path.join(appRoot, 'server', 'todoGenerationSanitize.js'));

  const capture = {
    title: '',
    content: 'Finish the garden including installing the gate door, placing headers, and trimming posts.',
  };

  const badResult = {
    strategy: 'ai',
    todos: [
      { clientId: 'parent', title: capture.content, parentClientId: null, sortOrder: 0 },
      { clientId: 'child-1', title: 'Install the gate door', parentClientId: 'parent', sortOrder: 0 },
      { clientId: 'child-2', title: 'Place headers', parentClientId: 'parent', sortOrder: 1 },
      { clientId: 'child-3', title: 'Trim posts', parentClientId: 'parent', sortOrder: 2 },
    ],
  };

  const sanitizedTs = sanitizeTodoGeneration(capture, badResult);
  assert.strictEqual(sanitizedTs.todos[0].title, 'Finish the garden');
  assert.ok((sanitizedTs.corrections ?? []).some(entry => entry.includes('Shortened parent title')));

  const sanitizedJs = sanitizeJs(capture, badResult);
  assert.strictEqual(sanitizedJs.todos[0].title, 'Finish the garden');

  const alreadyGood = sanitizeTodoGeneration(capture, {
    strategy: 'ai',
    todos: [
      { clientId: 'parent', title: 'Finish the garden', parentClientId: null, sortOrder: 0 },
      { clientId: 'child-1', title: 'Install the gate door', parentClientId: 'parent', sortOrder: 0 },
    ],
  });
  assert.strictEqual(alreadyGood.todos[0].title, 'Finish the garden');
  assert.strictEqual((alreadyGood.corrections ?? []).length, 0);

  console.log('All todo generation sanitize tests passed.');
}

try {
  runTests();
} catch (error) {
  console.error(error);
  process.exit(1);
}