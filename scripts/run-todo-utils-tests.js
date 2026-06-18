const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.join(__dirname, '.tmp-todo-utils-tests');

function compileModules() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const args = [
    path.join(appRoot, 'utils', 'todoTree.ts'),
    path.join(appRoot, 'utils', 'todoParsing.ts'),
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
    throw new Error('Failed to compile todo utils for tests.');
  }
}

function loadModules() {
  const { parseTodosFromCapture } = require(path.join(buildDir, 'utils', 'todoParsing.js'));
  const {
    flattenTodoTree,
    countSubtreeTodos,
    todoHasChildren,
    collectDescendantIds,
  } = require(path.join(buildDir, 'utils', 'todoTree.js'));
  return { parseTodosFromCapture, flattenTodoTree, countSubtreeTodos, todoHasChildren, collectDescendantIds };
}

function makeTodo(id, title, overrides = {}) {
  return {
    id,
    title,
    completed: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function runTests() {
  compileModules();
  const {
    parseTodosFromCapture,
    flattenTodoTree,
    countSubtreeTodos,
    todoHasChildren,
    collectDescendantIds,
  } = loadModules();

  const single = parseTodosFromCapture('Errands', 'Buy milk');
  assert.strictEqual(single.length, 1);
  assert.strictEqual(single[0].title, 'Errands');
  assert.strictEqual(single[0].content, 'Buy milk');

  const nested = parseTodosFromCapture('Project', '- design\n- build\n- ship');
  assert.strictEqual(nested.length, 4);
  assert.strictEqual(nested[0].title, 'Project');
  assert.strictEqual(nested.filter(todo => todo.parentId).length, 3);

  const todos = [
    makeTodo('a', 'Parent', { sortOrder: 0 }),
    makeTodo('b', 'Child', { parentId: 'a', sortOrder: 0 }),
    makeTodo('c', 'Sibling', { sortOrder: 1 }),
  ];

  const expanded = flattenTodoTree(todos);
  assert.deepStrictEqual(expanded.map(item => item.todo.id), ['a', 'b', 'c']);

  const collapsed = flattenTodoTree(todos, true, new Set(['a']));
  assert.deepStrictEqual(collapsed.map(item => item.todo.id), ['a', 'c']);

  assert.strictEqual(todoHasChildren(todos, 'a'), true);
  assert.strictEqual(todoHasChildren(todos, 'c'), false);
  assert.strictEqual(countSubtreeTodos(todos, 'a'), 1);

  const descendants = collectDescendantIds(todos, 'a');
  assert.strictEqual(descendants.has('a'), true);
  assert.strictEqual(descendants.has('b'), true);
  assert.strictEqual(descendants.has('c'), false);

  console.log('All todo utils tests passed.');
}

try {
  runTests();
} catch (error) {
  console.error(error);
  process.exit(1);
}