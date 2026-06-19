import { ExistingTodoSummary, InboxCapture, Todo, TodoGenerationDraft, TodoGenerationResult } from '../types';
import { getNextSortOrder } from './todoTree';

const APPEND_TO_LIST_PATTERN = /\b(?:add|append|include|put)\s+(.+?)\s+(?:to|on|into)\s+(?:the\s+|my\s+)?(.+)$/i;
const APPEND_TO_GENERIC_LIST_PATTERN = /\b(?:add|append|include|put)\s+(.+?)\s+(?:to|on|into)\s+(?:that|the)\s+list\b/i;

const normalizeListName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/\s+(?:list|tasks?|chores?|todo(?:\s+list)?)$/i, '')
    .trim();

export const buildExistingTodoSummariesForGeneration = (
  todos: Todo[],
  limit = 80
): ExistingTodoSummary[] => {
  return todos.slice(0, limit).map(todo => ({
    clientId: todo.id,
    title: todo.title,
    parentClientId: todo.parentId ?? null,
    sortOrder: todo.sortOrder,
    completed: todo.completed,
  }));
};

export const findTodoListParentByTitle = (
  reference: string,
  todos: Todo[]
): Todo | undefined => {
  const needle = normalizeListName(reference);
  if (!needle) {
    return undefined;
  }

  const candidates = todos.filter(todo => !todo.parentId || todos.some(child => child.parentId === todo.id));
  const uniqueRoots = Array.from(new Map(
    candidates.map(todo => [todo.parentId ? todos.find(parent => parent.id === todo.parentId)?.id ?? todo.id : todo.id, todo.parentId
      ? todos.find(parent => parent.id === todo.parentId) ?? todo
      : todo])
  ).values());

  const roots = todos.filter(todo => !todo.parentId);
  const searchable = roots.length > 0 ? roots : uniqueRoots;

  const exact = searchable.find(todo => normalizeListName(todo.title) === needle);
  if (exact) {
    return exact;
  }

  return searchable.find(todo => {
    const haystack = normalizeListName(todo.title);
    return haystack.includes(needle) || needle.includes(haystack);
  });
};

export const findRecentTodoListParent = (todos: Todo[]): Todo | undefined => {
  const roots = todos
    .filter(todo => !todo.parentId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const withChildren = roots.filter(root => todos.some(todo => todo.parentId === root.id));
  return withChildren[0] ?? roots[0];
};

export const parseAppendToListIntent = (
  title: string,
  content: string
): { taskTitle: string; listReference: string } | { taskTitle: string; useRecentList: true } | null => {
  const combined = `${title}\n${content}`.trim();
  if (!combined) {
    return null;
  }

  const genericMatch = combined.match(APPEND_TO_GENERIC_LIST_PATTERN);
  if (genericMatch) {
    return {
      taskTitle: genericMatch[1].trim(),
      useRecentList: true,
    };
  }

  const match = combined.match(APPEND_TO_LIST_PATTERN);
  if (!match) {
    return null;
  }

  return {
    taskTitle: match[1].trim(),
    listReference: match[2].trim(),
  };
};

export const buildLocalAppendTodoGeneration = (
  capture: Pick<InboxCapture, 'title' | 'content'>,
  existingTodos: Todo[]
): TodoGenerationResult | null => {
  const intent = parseAppendToListIntent(capture.title, capture.content);
  if (!intent) {
    return null;
  }

  const parent = 'useRecentList' in intent
    ? findRecentTodoListParent(existingTodos)
    : findTodoListParentByTitle(intent.listReference, existingTodos);

  if (!parent) {
    return null;
  }

  const taskTitle = intent.taskTitle
    .replace(/^(?:a\s+)?task\s+/i, '')
    .replace(/\s+as\s+a\s+task$/i, '')
    .trim();

  if (!taskTitle) {
    return null;
  }

  const nextSortOrder = getNextSortOrder(existingTodos, parent.id);

  return {
    todos: [{
      clientId: `append-${Date.now()}`,
      title: taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1),
      parentClientId: parent.id,
      sortOrder: nextSortOrder,
    }],
    strategy: 'local',
    confidenceBand: 'medium',
  };
};

const isNewGenerationDraft = (
  draft: TodoGenerationDraft,
  existingIds: Set<string>
): boolean => !existingIds.has(draft.clientId);

export const mapTodoGenerationToTodosWithExisting = (
  drafts: TodoGenerationDraft[],
  existingTodos: Todo[],
  baseTimestamp = Date.now()
): Todo[] => {
  if (drafts.length === 0) {
    return [];
  }

  const existingIds = new Set(existingTodos.map(todo => todo.id));
  const newDrafts = drafts.filter(draft => isNewGenerationDraft(draft, existingIds));

  if (newDrafts.length === 0) {
    return [];
  }

  const createdAt = new Date().toISOString();
  const idByClientId = new Map<string, string>();

  newDrafts.forEach((draft, index) => {
    idByClientId.set(draft.clientId, `${baseTimestamp}-${index}`);
  });

  return newDrafts.map((draft, index) => {
    let parentId: string | undefined;
    if (draft.parentClientId) {
      parentId = existingIds.has(draft.parentClientId)
        ? draft.parentClientId
        : idByClientId.get(draft.parentClientId);
    }

    const sortOrder = draft.parentClientId && existingIds.has(draft.parentClientId)
      ? (draft.sortOrder ?? getNextSortOrder(existingTodos, draft.parentClientId))
      : (draft.sortOrder ?? index);

    return {
      id: idByClientId.get(draft.clientId) ?? `${baseTimestamp}-${index}`,
      title: draft.title.trim(),
      content: draft.content?.trim() || undefined,
      completed: false,
      parentId,
      sortOrder,
      createdAt,
      dueDate: draft.dueDate,
      relatedAddresses: draft.relatedAddresses?.length ? draft.relatedAddresses : undefined,
    };
  });
};

export const mergeTodoGenerationIntoExisting = (
  generation: TodoGenerationResult,
  existingTodos: Todo[],
  capture: Pick<InboxCapture, 'title' | 'content'>
): Todo[] => {
  let drafts = generation.todos ?? [];
  const existingIds = new Set(existingTodos.map(todo => todo.id));
  const appendParents = drafts
    .map(draft => draft.parentClientId)
    .filter((parentId): parentId is string => Boolean(parentId && existingIds.has(parentId)));

  if (appendParents.length === 0 && (generation.strategy === 'local' || drafts.length === 0)) {
    const localAppend = buildLocalAppendTodoGeneration(capture, existingTodos);
    if (localAppend) {
      drafts = localAppend.todos;
    }
  }

  const newTodos = mapTodoGenerationToTodosWithExisting(drafts, existingTodos);
  if (newTodos.length === 0) {
    return existingTodos;
  }

  return [...existingTodos, ...newTodos];
};