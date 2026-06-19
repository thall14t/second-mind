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
    path.join(appRoot, 'utils', 'todoDates.ts'),
    path.join(appRoot, 'utils', 'todoParsing.ts'),
    path.join(appRoot, 'utils', 'todoAppend.ts'),
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
    getTodoAncestorChain,
    projectTodosForZoom,
    buildAutoCollapsedParentIds,
    insertSiblingTodo,
    toggleTodoCompletion,
    AUTO_COLLAPSE_OPEN_THRESHOLD,
  } = require(path.join(buildDir, 'utils', 'todoTree.js'));
  const {
    parseAppendToListIntent,
    findTodoListParentByTitle,
    mergeTodoGenerationIntoExisting,
    buildLocalAppendTodoGeneration,
  } = require(path.join(buildDir, 'utils', 'todoAppend.js'));
  return {
    parseTodosFromCapture,
    flattenTodoTree,
    countSubtreeTodos,
    todoHasChildren,
    collectDescendantIds,
    getTodoAncestorChain,
    projectTodosForZoom,
    buildAutoCollapsedParentIds,
    insertSiblingTodo,
    toggleTodoCompletion,
    AUTO_COLLAPSE_OPEN_THRESHOLD,
    parseAppendToListIntent,
    findTodoListParentByTitle,
    mergeTodoGenerationIntoExisting,
    buildLocalAppendTodoGeneration,
  };
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
    getTodoAncestorChain,
    projectTodosForZoom,
    buildAutoCollapsedParentIds,
    insertSiblingTodo,
    toggleTodoCompletion,
    AUTO_COLLAPSE_OPEN_THRESHOLD,
    parseAppendToListIntent,
    findTodoListParentByTitle,
    mergeTodoGenerationIntoExisting,
    buildLocalAppendTodoGeneration,
  } = loadModules();

  const single = parseTodosFromCapture('Errands', 'Buy milk');
  assert.strictEqual(single.length, 1);
  assert.strictEqual(single[0].title, 'Errands');
  assert.strictEqual(single[0].content, 'Buy milk');

  const nested = parseTodosFromCapture('Project', '- design\n- build\n- ship');
  assert.strictEqual(nested.length, 4);
  assert.strictEqual(nested[0].title, 'Project');
  assert.strictEqual(nested.filter(todo => todo.parentId).length, 3);

  const houseChores = parseTodosFromCapture(
    'House chores',
    'vacuum living room\ndo dishes\nfold laundry'
  );
  assert.strictEqual(houseChores.length, 4);
  assert.strictEqual(houseChores[0].title, 'House chores');
  assert.deepStrictEqual(
    houseChores.filter(todo => todo.parentId).map(todo => todo.title),
    ['Vacuum living room', 'Do dishes', 'Fold laundry']
  );

  const garden = parseTodosFromCapture(
    '',
    'Finish the garden including installing the gate door, placing headers, and trimming posts.'
  );
  assert.strictEqual(garden.length, 4);
  assert.strictEqual(garden[0].title, 'Finish the garden');
  assert.deepStrictEqual(
    garden.filter(todo => todo.parentId).map(todo => todo.title),
    ['Installing the gate door', 'Placing headers', 'Trimming posts']
  );

  const jeep = parseTodosFromCapture(
    '',
    'I need to fix jeep by this sunday including oil change and tire rotation',
    new Date('2026-06-18T12:00:00')
  );
  assert.strictEqual(jeep.length, 3);
  assert.strictEqual(jeep[0].title, 'Fix jeep');
  assert.strictEqual(jeep[0].dueDate, '2026-06-21');
  assert.deepStrictEqual(
    jeep.filter(todo => todo.parentId).map(todo => todo.title),
    ['Oil change', 'Tire rotation']
  );

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

  const ancestorChain = getTodoAncestorChain(todos, 'b');
  assert.deepStrictEqual(ancestorChain.map(todo => todo.id), ['a', 'b']);

  const zoomed = projectTodosForZoom(todos, 'a');
  assert.strictEqual(zoomed.length, 2);
  assert.strictEqual(zoomed.find(todo => todo.id === 'a')?.parentId, undefined);
  assert.strictEqual(zoomed.find(todo => todo.id === 'b')?.parentId, 'a');
  assert.strictEqual(zoomed.some(todo => todo.id === 'c'), false);

  const smallList = [
    makeTodo('p1', 'Parent 1', { sortOrder: 0 }),
    makeTodo('c1', 'Child', { parentId: 'p1', sortOrder: 0 }),
  ];
  assert.deepStrictEqual(buildAutoCollapsedParentIds(smallList), []);

  const largeList = Array.from({ length: AUTO_COLLAPSE_OPEN_THRESHOLD }, (_, index) =>
    makeTodo(`open-${index}`, `Task ${index}`, { sortOrder: index })
  );
  largeList.push(makeTodo('parent', 'Parent', { sortOrder: AUTO_COLLAPSE_OPEN_THRESHOLD }));
  largeList.push(makeTodo('child', 'Child', { parentId: 'parent', sortOrder: 0 }));
  assert.deepStrictEqual(buildAutoCollapsedParentIds(largeList), ['parent']);

  const nestedTodos = [
    makeTodo('parent', 'Parent', { sortOrder: 0 }),
    makeTodo('child', 'Child', { parentId: 'parent', sortOrder: 0 }),
    makeTodo('grandchild', 'Grandchild', { parentId: 'child', sortOrder: 0 }),
    makeTodo('leaf', 'Leaf', { sortOrder: 1 }),
  ];
  const completedSubtree = toggleTodoCompletion(nestedTodos, 'parent');
  assert.strictEqual(completedSubtree.find(todo => todo.id === 'parent')?.completed, true);
  assert.strictEqual(completedSubtree.find(todo => todo.id === 'child')?.completed, true);
  assert.strictEqual(completedSubtree.find(todo => todo.id === 'grandchild')?.completed, true);
  assert.strictEqual(completedSubtree.find(todo => todo.id === 'leaf')?.completed, false);

  const reopenedParent = toggleTodoCompletion(completedSubtree, 'parent');
  assert.strictEqual(reopenedParent.find(todo => todo.id === 'parent')?.completed, false);
  assert.strictEqual(reopenedParent.find(todo => todo.id === 'child')?.completed, false);
  assert.strictEqual(reopenedParent.find(todo => todo.id === 'grandchild')?.completed, false);

  const completedLeaf = toggleTodoCompletion(nestedTodos, 'leaf');
  assert.strictEqual(completedLeaf.find(todo => todo.id === 'leaf')?.completed, true);
  assert.strictEqual(completedLeaf.find(todo => todo.id === 'parent')?.completed, false);

  const inserted = insertSiblingTodo(todos, 'b', { title: 'Between' });
  assert.ok(inserted);
  assert.strictEqual(inserted.newTodoId.endsWith('-sibling'), true);
  const insertedSibling = inserted.todos.find(todo => todo.id === inserted.newTodoId);
  assert.strictEqual(insertedSibling?.parentId, 'a');
  assert.strictEqual(insertedSibling?.title, 'Between');
  const zoomedSiblings = inserted.todos
    .filter(todo => todo.parentId === 'a')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(todo => todo.id);
  assert.deepStrictEqual(zoomedSiblings, ['b', inserted.newTodoId]);

  const appendIntent = parseAppendToListIntent('', 'Add wipe counters to house chores');
  assert.deepStrictEqual(appendIntent, {
    taskTitle: 'wipe counters',
    listReference: 'house chores',
  });

  const genericListIntent = parseAppendToListIntent('', 'add mop kitchen to that list');
  assert.deepStrictEqual(genericListIntent, {
    taskTitle: 'mop kitchen',
    useRecentList: true,
  });

  const houseChoresTodos = [
    makeTodo('house-root', 'House chores', { sortOrder: 0, createdAt: '2026-06-18T10:00:00.000Z' }),
    makeTodo('house-child-1', 'Vacuum living room', { parentId: 'house-root', sortOrder: 0, createdAt: '2026-06-18T10:00:00.000Z' }),
    makeTodo('house-child-2', 'Do dishes', { parentId: 'house-root', sortOrder: 1, createdAt: '2026-06-18T10:00:00.000Z' }),
  ];
  const houseParent = findTodoListParentByTitle('house chores', houseChoresTodos);
  assert.strictEqual(houseParent?.id, 'house-root');

  const localAppend = buildLocalAppendTodoGeneration(
    { title: '', content: 'Add wipe counters to house chores' },
    houseChoresTodos
  );
  assert.strictEqual(localAppend?.todos.length, 1);
  assert.strictEqual(localAppend?.todos[0].parentClientId, 'house-root');
  assert.strictEqual(localAppend?.todos[0].title, 'Wipe counters');

  const mergedLocal = mergeTodoGenerationIntoExisting(
    { todos: [], strategy: 'local' },
    houseChoresTodos,
    { title: '', content: 'Add wipe counters to house chores' }
  );
  assert.strictEqual(mergedLocal.length, 4);
  const appendedLocal = mergedLocal.find(todo => todo.title === 'Wipe counters');
  assert.strictEqual(appendedLocal?.parentId, 'house-root');

  const mergedAiIgnored = mergeTodoGenerationIntoExisting(
    {
      todos: [{ clientId: 'new-root', title: 'Standalone task', parentClientId: null, sortOrder: 0 }],
      strategy: 'ai',
    },
    houseChoresTodos,
    { title: '', content: 'Add wipe counters to house chores' }
  );
  assert.strictEqual(mergedAiIgnored.length, 4);
  assert.strictEqual(mergedAiIgnored.some(todo => todo.title === 'Wipe counters'), false);
  assert.strictEqual(mergedAiIgnored.some(todo => todo.title === 'Standalone task'), true);

  console.log('All todo utils tests passed.');
}

try {
  runTests();
} catch (error) {
  console.error(error);
  process.exit(1);
}