import { Todo } from '../types';

export interface TodoTreeNode {
  todo: Todo;
  depth: number;
  children: TodoTreeNode[];
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