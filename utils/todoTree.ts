import { Todo } from '../types';

export interface TodoTreeNode {
  todo: Todo;
  depth: number;
  children: TodoTreeNode[];
}

export interface FlatTodoItem {
  todo: Todo;
  depth: number;
}

const ROOT_PARENT_KEY = '__root__';

export const getTodoParentKey = (parentId?: string) => parentId ?? ROOT_PARENT_KEY;

export const compareTodosByOrder = (a: Todo, b: Todo): number => {
  const orderDiff = a.sortOrder - b.sortOrder;
  if (orderDiff !== 0) {
    return orderDiff;
  }

  return a.createdAt.localeCompare(b.createdAt);
};

export const ensureTodoSortOrders = (todos: Todo[]): Todo[] => {
  const groups = new Map<string, Todo[]>();

  for (const todo of todos) {
    const key = getTodoParentKey(todo.parentId);
    const group = groups.get(key) ?? [];
    group.push(todo);
    groups.set(key, group);
  }

  const orderById = new Map<string, number>();

  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => {
      const leftHasOrder = Number.isFinite(left.sortOrder);
      const rightHasOrder = Number.isFinite(right.sortOrder);

      if (leftHasOrder && rightHasOrder && left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      if (leftHasOrder !== rightHasOrder) {
        return leftHasOrder ? -1 : 1;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });

    sorted.forEach((todo, index) => {
      orderById.set(todo.id, index);
    });
  }

  return todos.map(todo => ({
    ...todo,
    sortOrder: orderById.get(todo.id) ?? 0,
  }));
};

export const getTodoSiblings = (todos: Todo[], todo: Todo): Todo[] =>
  todos
    .filter(item => getTodoParentKey(item.parentId) === getTodoParentKey(todo.parentId))
    .sort(compareTodosByOrder);

export const getNextSortOrder = (todos: Todo[], parentId?: string): number => {
  const siblings = todos.filter(item => (item.parentId ?? undefined) === (parentId ?? undefined));
  if (siblings.length === 0) {
    return 0;
  }

  return Math.max(...siblings.map(item => item.sortOrder)) + 1;
};

export const collectDescendantIds = (todos: Todo[], rootId: string): Set<string> => {
  const ids = new Set<string>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const todo of todos) {
      if (todo.parentId && ids.has(todo.parentId) && !ids.has(todo.id)) {
        ids.add(todo.id);
        changed = true;
      }
    }
  }

  return ids;
};

const getEffectiveVisibleParentId = (
  todo: Todo,
  visibleIds: Set<string>,
  todoById: Map<string, Todo>
): string | undefined => {
  let parentId = todo.parentId;

  while (parentId && !visibleIds.has(parentId)) {
    parentId = todoById.get(parentId)?.parentId;
  }

  return parentId;
};

export const getTodosForDisplay = (todos: Todo[], showCompleted: boolean): Todo[] => {
  if (showCompleted) {
    return todos;
  }

  const visibleTodos = todos.filter(todo => !todo.completed);
  const visibleIds = new Set(visibleTodos.map(todo => todo.id));
  const todoById = new Map(todos.map(todo => [todo.id, todo]));

  return visibleTodos.map(todo => ({
    ...todo,
    parentId: getEffectiveVisibleParentId(todo, visibleIds, todoById),
  }));
};

export const buildTodoTree = (todos: Todo[]): TodoTreeNode[] => {
  const byParent = new Map<string, Todo[]>();

  for (const todo of todos) {
    const key = getTodoParentKey(todo.parentId);
    const group = byParent.get(key) ?? [];
    group.push(todo);
    byParent.set(key, group);
  }

  for (const group of byParent.values()) {
    group.sort(compareTodosByOrder);
  }

  const buildNodes = (parentId: string | undefined, depth: number): TodoTreeNode[] => {
    const siblings = byParent.get(getTodoParentKey(parentId)) ?? [];
    return siblings.map(todo => ({
      todo,
      depth,
      children: buildNodes(todo.id, depth + 1),
    }));
  };

  return buildNodes(undefined, 0);
};

export const moveTodoAmongSiblings = (
  todos: Todo[],
  todoId: string,
  direction: 'up' | 'down'
): Todo[] => {
  const todo = todos.find(item => item.id === todoId);
  if (!todo) {
    return todos;
  }

  const siblings = getTodoSiblings(todos, todo);
  const currentIndex = siblings.findIndex(item => item.id === todoId);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return todos;
  }

  const current = siblings[currentIndex];
  const target = siblings[targetIndex];

  return todos.map(item => {
    if (item.id === current.id) {
      return { ...item, sortOrder: target.sortOrder };
    }

    if (item.id === target.id) {
      return { ...item, sortOrder: current.sortOrder };
    }

    return item;
  });
};

export const countDirectChildren = (
  todos: Todo[],
  parentId: string,
  showCompleted = true
): number =>
  getTodosForDisplay(todos, showCompleted).filter(todo => todo.parentId === parentId).length;

export const todoHasChildren = (
  todos: Todo[],
  todoId: string,
  showCompleted = true
): boolean => countDirectChildren(todos, todoId, showCompleted) > 0;

export const flattenTodoTree = (
  todos: Todo[],
  showCompleted = true,
  collapsedIds: ReadonlySet<string> = new Set()
): FlatTodoItem[] => {
  const result: FlatTodoItem[] = [];
  const displayTodos = getTodosForDisplay(todos, showCompleted);

  const walk = (nodes: TodoTreeNode[]) => {
    for (const node of nodes) {
      result.push({ todo: node.todo, depth: node.depth });
      if (!collapsedIds.has(node.todo.id)) {
        walk(node.children);
      }
    }
  };

  walk(buildTodoTree(displayTodos));
  return result;
};

export const countSubtreeTodos = (
  todos: Todo[],
  todoId: string,
  showCompleted = true
): number => {
  const flat = flattenTodoTree(todos, showCompleted);
  const index = flat.findIndex(item => item.todo.id === todoId);
  if (index < 0) {
    return 0;
  }

  const rootDepth = flat[index].depth;
  let count = 0;

  for (let i = index + 1; i < flat.length; i++) {
    if (flat[i].depth <= rootDepth) {
      break;
    }
    count++;
  }

  return count;
};

export const countCompletedTodos = (todos: Todo[]): number =>
  todos.filter(todo => todo.completed).length;

export const clampFlatTodoDepths = (flat: FlatTodoItem[]): FlatTodoItem[] => {
  const result: FlatTodoItem[] = [];

  flat.forEach((item, index) => {
    if (index === 0) {
      result.push({ ...item, depth: 0 });
      return;
    }

    const previousDepth = result[index - 1].depth;
    const depth = Math.max(0, Math.min(item.depth, previousDepth + 1));
    result.push({ ...item, depth });
  });

  return result;
};

export const rebuildTodosFromFlatOrder = (
  todos: Todo[],
  flatOrder: Array<{ id: string; depth: number }>
): Todo[] => {
  const todoById = new Map(todos.map(todo => [todo.id, todo]));
  const parentStack: string[] = [];
  const siblingCounts = new Map<string, number>();
  const updated: Todo[] = [];

  for (const { id, depth } of flatOrder) {
    while (parentStack.length > depth) {
      parentStack.pop();
    }

    const parentId = depth === 0 ? undefined : parentStack[depth - 1];
    const parentKey = getTodoParentKey(parentId);
    const sortOrder = siblingCounts.get(parentKey) ?? 0;
    siblingCounts.set(parentKey, sortOrder + 1);
    parentStack[depth] = id;

    const existing = todoById.get(id);
    if (existing) {
      updated.push({ ...existing, parentId, sortOrder });
    }
  }

  return updated;
};

export const adjustDepthAfterDrag = (
  flat: FlatTodoItem[],
  from: number,
  to: number
): FlatTodoItem[] => {
  const result = flat.map(item => ({ ...item }));
  const moved = result[to];
  if (!moved) {
    return result;
  }

  if (to > from && to > 0) {
    moved.depth = result[to - 1].depth + 1;
  } else if (to < from) {
    const below = result[to + 1];
    moved.depth = below ? below.depth : 0;
  }

  return clampFlatTodoDepths(result);
};

export const reorderTodosFromDrag = (
  todos: Todo[],
  flat: FlatTodoItem[],
  from: number,
  to: number
): Todo[] => {
  const adjusted = adjustDepthAfterDrag(flat, from, to);
  return rebuildTodosFromFlatOrder(
    todos,
    adjusted.map(item => ({ id: item.todo.id, depth: item.depth }))
  );
};

export const indentTodo = (todos: Todo[], todoId: string): Todo[] => {
  const flat = flattenTodoTree(todos);
  const index = flat.findIndex(item => item.todo.id === todoId);
  if (index <= 0) {
    return todos;
  }

  flat[index] = { ...flat[index], depth: flat[index - 1].depth + 1 };
  return rebuildTodosFromFlatOrder(
    todos,
    clampFlatTodoDepths(flat).map(item => ({ id: item.todo.id, depth: item.depth }))
  );
};

export const outdentTodo = (todos: Todo[], todoId: string): Todo[] => {
  const flat = flattenTodoTree(todos);
  const index = flat.findIndex(item => item.todo.id === todoId);
  if (index < 0 || flat[index].depth === 0) {
    return todos;
  }

  flat[index] = { ...flat[index], depth: flat[index].depth - 1 };
  return rebuildTodosFromFlatOrder(
    todos,
    clampFlatTodoDepths(flat).map(item => ({ id: item.todo.id, depth: item.depth }))
  );
};

export const canIndentTodo = (todos: Todo[], todoId: string): boolean => {
  const flat = flattenTodoTree(todos);
  const index = flat.findIndex(item => item.todo.id === todoId);
  return index > 0;
};

export const canOutdentTodo = (todos: Todo[], todoId: string): boolean => {
  const flat = flattenTodoTree(todos);
  const index = flat.findIndex(item => item.todo.id === todoId);
  return index >= 0 && flat[index].depth > 0;
};

export const canMoveTodo = (todos: Todo[], todoId: string, direction: 'up' | 'down'): boolean => {
  const todo = todos.find(item => item.id === todoId);
  if (!todo) {
    return false;
  }

  const siblings = getTodoSiblings(todos, todo);
  const currentIndex = siblings.findIndex(item => item.id === todoId);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  return currentIndex >= 0 && targetIndex >= 0 && targetIndex < siblings.length;
};