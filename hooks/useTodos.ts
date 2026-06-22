import { useCallback } from 'react';
import { Alert } from 'react-native';
import { AppSettings, Todo } from '../types';
import { normalizeAddress, parseCommaSeparatedValues } from '../utils/antinet';
import { saveTodosToFile, saveSettingsToFile } from '../utils/persistence';
import { useDataStore } from '../utils/stores/dataStore';
import {
  collectDescendantIds,
  FlatTodoItem,
  getNextSortOrder,
  indentTodo,
  insertSiblingTodo,
  outdentTodo,
  reorderTodosFromDrag,
  toggleTodoCompletion,
} from '../utils/todoTree';
import { normalizeTodoDueDateInput } from '../utils/todoDates';

export function useTodos() {
  const { todos, settings, setTodos, setSettings } = useDataStore();

  const saveTodos = useCallback(async (updated: Todo[]) => {
    await saveTodosToFile(updated);
    setTodos(updated);
  }, [setTodos]);

  const saveSettings = useCallback(async (updated: AppSettings) => {
    await saveSettingsToFile(updated);
    setSettings(updated);
  }, [setSettings]);

  const toggle = useCallback(async (todoId: string) => {
    await saveTodos(toggleTodoCompletion(todos, todoId));
  }, [todos, saveTodos]);

  const remove = useCallback(async (todoId: string) => {
    const idsToDelete = collectDescendantIds(todos, todoId);
    await saveTodos(todos.filter(t => !idsToDelete.has(t.id)));

    const prunedCollapsed = (settings.collapsedTodoIds ?? []).filter(id => !idsToDelete.has(id));
    if (prunedCollapsed.length !== (settings.collapsedTodoIds ?? []).length) {
      await saveSettings({ ...settings, collapsedTodoIds: prunedCollapsed });
    }
  }, [todos, settings, saveTodos, saveSettings]);

  const addSub = useCallback(async (parentId: string, title = ''): Promise<string> => {
    const newTodo: Todo = {
      id: `${Date.now()}-sub`,
      title,
      completed: false,
      parentId,
      sortOrder: getNextSortOrder(todos, parentId),
      createdAt: new Date().toISOString(),
    };
    await saveTodos([newTodo, ...todos]);
    return newTodo.id;
  }, [todos, saveTodos]);

  const addSibling = useCallback(async (afterTodoId: string, title = ''): Promise<string | null> => {
    const inserted = insertSiblingTodo(todos, afterTodoId, { title });
    if (!inserted) return null;
    await saveTodos(inserted.todos);
    return inserted.newTodoId;
  }, [todos, saveTodos]);

  const update = useCallback(async (
    todoId: string,
    updates: { title: string; content?: string; relatedAddressesText?: string; dueDate?: string },
    options?: { quiet?: boolean }
  ): Promise<boolean> => {
    const trimmedTitle = updates.title.trim();
    if (!trimmedTitle) {
      if (!options?.quiet) Alert.alert('Title Required', 'Give this task a title before saving.');
      return false;
    }

    const normalizedDueDate = updates.dueDate === undefined
      ? undefined
      : normalizeTodoDueDateInput(updates.dueDate);

    if (updates.dueDate?.trim() && !normalizedDueDate) {
      if (!options?.quiet) Alert.alert('Invalid Due Date', 'Use YYYY-MM-DD or a recognizable date.');
      return false;
    }

    const relatedAddresses = parseCommaSeparatedValues(updates.relatedAddressesText ?? '').map(normalizeAddress);
    await saveTodos(todos.map(t =>
      t.id === todoId
        ? {
            ...t,
            title: trimmedTitle,
            content: updates.content?.trim() || undefined,
            relatedAddresses: relatedAddresses.length ? relatedAddresses : undefined,
            dueDate: normalizedDueDate,
          }
        : t
    ));
    return true;
  }, [todos, saveTodos]);

  const saveCollapsedIds = useCallback(async (collapsedTodoIds: string[]) => {
    const validIds = new Set(todos.map(t => t.id));
    await saveSettings({ ...settings, collapsedTodoIds: collapsedTodoIds.filter(id => validIds.has(id)) });
  }, [todos, settings, saveSettings]);

  const reorder = useCallback(async (flat: FlatTodoItem[], from: number, to: number) => {
    await saveTodos(reorderTodosFromDrag(todos, flat, from, to));
  }, [todos, saveTodos]);

  const indent = useCallback(async (todoId: string) => {
    const updated = indentTodo(todos, todoId);
    if (updated !== todos) await saveTodos(updated);
  }, [todos, saveTodos]);

  const outdent = useCallback(async (todoId: string) => {
    const updated = outdentTodo(todos, todoId);
    if (updated !== todos) await saveTodos(updated);
  }, [todos, saveTodos]);

  return { toggle, remove, addSub, addSibling, update, saveCollapsedIds, reorder, indent, outdent };
}
