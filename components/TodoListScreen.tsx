import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Todo } from '../types';
import { normalizeTodoDueDateInput } from '../utils/todoDates';

import {
  canIndentTodo,
  canOutdentTodo,
  collectDescendantIds,
  countCompletedTodos,
  countSubtreeTodos,
  FlatTodoItem,
  flattenTodoTree,
  todoHasChildren,
} from '../utils/todoTree';

const TODO_NEST_STEP = 10;
const TODO_MAX_NEST_GUIDES = 5;
const AUTO_SAVE_DELAY_MS = 600;
const COLLAPSE_SAVE_DELAY_MS = 300;

interface TodoListScreenProps {
  darkMode: boolean;
  todos: Todo[];
  collapsedTodoIds: string[];
  onToggleTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddSubTodo: (parentId: string) => void;
  onUpdateTodo: (
    todoId: string,
    updates: {
      title: string;
      content?: string;
      relatedAddressesText?: string;
      dueDate?: string;
    },
    options?: { quiet?: boolean }
  ) => boolean | Promise<boolean>;
  onCollapsedTodoIdsChange: (collapsedTodoIds: string[]) => void | Promise<void>;
  onReorderTodos: (flat: FlatTodoItem[], from: number, to: number) => void | Promise<void>;
  onIndentTodo: (todoId: string) => void | Promise<void>;
  onOutdentTodo: (todoId: string) => void | Promise<void>;
  onOpenLinkedCard: (address: string) => void;
  onBack: () => void;
}

export default function TodoListScreen({
  darkMode,
  todos,
  collapsedTodoIds,
  onToggleTodo,
  onDeleteTodo,
  onAddSubTodo,
  onUpdateTodo,
  onCollapsedTodoIdsChange,
  onReorderTodos,
  onIndentTodo,
  onOutdentTodo,
  onOpenLinkedCard,
  onBack,
}: TodoListScreenProps) {
  const theme = getTheme(darkMode);
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(collapsedTodoIds));
  const collapsePersistReadyRef = useRef(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRelatedAddressesText, setEditRelatedAddressesText] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const completedCount = useMemo(() => countCompletedTodos(todos), [todos]);
  const openCount = todos.length - completedCount;
  const flatItems = useMemo(
    () => flattenTodoTree(todos, showCompleted, collapsedIds),
    [todos, showCompleted, collapsedIds]
  );
  const [listData, setListData] = useState(flatItems);
  const editingTodo = editingTodoId ? todos.find(todo => todo.id === editingTodoId) ?? null : null;

  useEffect(() => {
    setListData(flatItems);
  }, [flatItems]);

  useEffect(() => {
    setCollapsedIds(new Set(collapsedTodoIds));
    collapsePersistReadyRef.current = false;
  }, [collapsedTodoIds]);

  useEffect(() => {
    if (!collapsePersistReadyRef.current) {
      collapsePersistReadyRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      void onCollapsedTodoIdsChange([...collapsedIds]);
    }, COLLAPSE_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [collapsedIds, onCollapsedTodoIdsChange]);

  useEffect(() => {
    if (!showCompleted && editingTodo?.completed) {
      setEditingTodoId(null);
    }
  }, [editingTodo, showCompleted]);

  useEffect(() => {
    if (!editingTodoId) {
      setEditTitle('');
      setEditContent('');
      setEditRelatedAddressesText('');
      setEditDueDate('');
      return;
    }

    const todo = todos.find(item => item.id === editingTodoId);
    if (!todo) {
      return;
    }

    setEditTitle(todo.title);
    setEditContent(todo.content ?? '');
    setEditRelatedAddressesText((todo.relatedAddresses ?? []).join(', '));
    setEditDueDate(todo.dueDate ?? '');
  }, [editingTodoId]);

  useEffect(() => {
    if (!editingTodoId) {
      return;
    }

    if (!todos.some(item => item.id === editingTodoId)) {
      setEditingTodoId(null);
    }
  }, [editingTodoId, todos]);

  const buildEditPayload = useCallback(
    () => ({
      title: editTitle,
      content: editContent,
      relatedAddressesText: editRelatedAddressesText,
      dueDate: editDueDate,
    }),
    [editTitle, editContent, editRelatedAddressesText, editDueDate]
  );

  const isEditDirty = useCallback(
    (todo: Todo) =>
      editTitle !== todo.title ||
      (editContent || '') !== (todo.content ?? '') ||
      editRelatedAddressesText !== (todo.relatedAddresses ?? []).join(', ') ||
      editDueDate !== (todo.dueDate ?? ''),
    [editTitle, editContent, editRelatedAddressesText, editDueDate]
  );

  const canPersistEdit = useCallback(
    (todo: Todo) => {
      if (!editTitle.trim()) {
        return false;
      }

      if (editDueDate.trim() && !normalizeTodoDueDateInput(editDueDate)) {
        return false;
      }

      return isEditDirty(todo);
    },
    [editDueDate, editTitle, isEditDirty]
  );

  const persistEditing = useCallback(
    async (todoId?: string) => {
      const id = todoId ?? editingTodoId;
      if (!id) {
        return false;
      }

      const todo = todos.find(item => item.id === id);
      if (!todo || !canPersistEdit(todo)) {
        return false;
      }

      return onUpdateTodo(id, buildEditPayload(), { quiet: true });
    },
    [buildEditPayload, canPersistEdit, editingTodoId, onUpdateTodo, todos]
  );

  const collapseEditing = () => {
    setEditingTodoId(null);
  };

  const openEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
  };

  const flushAndCollapseEditing = async () => {
    await persistEditing();
    collapseEditing();
  };

  const handleBack = async () => {
    await persistEditing();
    onBack();
  };

  const toggleEditing = (todo: Todo) => {
    if (editingTodoId === todo.id) {
      void flushAndCollapseEditing();
      return;
    }

    void (async () => {
      await persistEditing();
      openEditing(todo);
    })();
  };

  const toggleSubtree = (todoId: string) => {
    setCollapsedIds(current => {
      const next = new Set(current);
      const willCollapse = !next.has(todoId);

      if (willCollapse) {
        next.add(todoId);
        if (editingTodoId) {
          const hiddenIds = collectDescendantIds(todos, todoId);
          if (hiddenIds.has(editingTodoId)) {
            void persistEditing(editingTodoId);
            setEditingTodoId(null);
          }
        }
      } else {
        next.delete(todoId);
      }

      return next;
    });
  };

  const handleAddSubTodo = (parentId: string) => {
    setCollapsedIds(current => {
      if (!current.has(parentId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(parentId);
      return next;
    });
    onAddSubTodo(parentId);
  };

  const persistEditingRef = useRef(persistEditing);
  persistEditingRef.current = persistEditing;

  useEffect(() => {
    if (!editingTodoId || !editingTodo || !canPersistEdit(editingTodo)) {
      return;
    }

    const timer = setTimeout(() => {
      void persistEditing();
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    editTitle,
    editContent,
    editRelatedAddressesText,
    editDueDate,
    editingTodo,
    editingTodoId,
    canPersistEdit,
    persistEditing,
  ]);

  useEffect(() => () => {
    void persistEditingRef.current();
  }, []);

  const handleDeleteTodo = (todoId: string) => {
    Alert.alert(
      'Delete Task?',
      'This removes the task and any sub-tasks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDeleteTodo(todoId);
            collapseEditing();
          },
        },
      ]
    );
  };

  const renderNestingGutter = (depth: number) => {
    if (depth === 0) {
      return null;
    }

    const guideCount = Math.min(depth, TODO_MAX_NEST_GUIDES);
    const showDepthBadge = depth > TODO_MAX_NEST_GUIDES;

    return (
      <View
        style={[
          styles.todoNestingGutter,
          { width: guideCount * TODO_NEST_STEP + (showDepthBadge ? 26 : 0) },
        ]}
      >
        {Array.from({ length: guideCount }, (_, index) => {
          const isActiveGuide = index === guideCount - 1;
          const guideLeft = index * TODO_NEST_STEP + TODO_NEST_STEP / 2;

          return (
            <React.Fragment key={`guide-${index}`}>
              <View
                style={[
                  isActiveGuide ? styles.todoNestGuideActive : styles.todoNestGuide,
                  {
                    left: guideLeft,
                    backgroundColor: isActiveGuide ? theme.accent : theme.border,
                    opacity: isActiveGuide ? 0.75 : 0.3,
                  },
                ]}
              />
              {isActiveGuide ? (
                <View
                  style={[
                    styles.todoNestBranch,
                    {
                      left: guideLeft,
                      backgroundColor: theme.accent,
                      opacity: 0.75,
                    },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {showDepthBadge ? (
          <View
            style={[
              styles.todoNestDepthBadge,
              { borderColor: theme.border, backgroundColor: theme.tertiaryBackground },
            ]}
          >
            <Text style={[styles.todoNestDepthText, { color: theme.mutedText }]}>{depth}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderInlineEditPanel = (todo: Todo) => (
    <View style={[styles.todoEditPanelInline, { backgroundColor: theme.tertiaryBackground, borderColor: theme.border }]}>
      <TextInput
        style={[styles.todoCompactInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={editTitle}
        onChangeText={setEditTitle}
        placeholder="Title"
        placeholderTextColor={theme.mutedText}
      />

      <TextInput
        style={[styles.todoCompactInput, styles.todoCompactNotesInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={editContent}
        onChangeText={setEditContent}
        placeholder="Notes"
        placeholderTextColor={theme.mutedText}
        multiline
        numberOfLines={2}
      />

      <View style={styles.todoCompactFieldRow}>
        <TextInput
          style={[styles.todoCompactInput, styles.todoCompactHalfInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editDueDate}
          onChangeText={setEditDueDate}
          placeholder="Due YYYY-MM-DD"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.todoCompactInput, styles.todoCompactHalfInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editRelatedAddressesText}
          onChangeText={setEditRelatedAddressesText}
          placeholder="Cards 0101a"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.todoCompactStructureRow}>
        <TouchableOpacity
          style={[
            styles.todoCompactIconButton,
            {
              backgroundColor: theme.secondaryBackground,
              borderWidth: 1,
              borderColor: theme.border,
              opacity: canOutdentTodo(todos, todo.id) ? 1 : 0.45,
            },
          ]}
          onPress={() => canOutdentTodo(todos, todo.id) && onOutdentTodo(todo.id)}
          disabled={!canOutdentTodo(todos, todo.id)}
        >
          <Text style={[styles.todoCompactActionIcon, { color: theme.secondaryButtonText }]}>{'\u2190'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.todoCompactIconButton,
            {
              backgroundColor: theme.secondaryBackground,
              borderWidth: 1,
              borderColor: theme.border,
              opacity: canIndentTodo(todos, todo.id) ? 1 : 0.45,
            },
          ]}
          onPress={() => canIndentTodo(todos, todo.id) && onIndentTodo(todo.id)}
          disabled={!canIndentTodo(todos, todo.id)}
        >
          <Text style={[styles.todoCompactActionIcon, { color: theme.secondaryButtonText }]}>{'\u2192'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTodoRow = ({ item, drag, isActive }: RenderItemParams<FlatTodoItem>) => {
    const { todo, depth } = item;
    const isEditing = editingTodoId === todo.id;
    const hasChildren = todoHasChildren(todos, todo.id, showCompleted);
    const isSubtreeCollapsed = collapsedIds.has(todo.id);
    const childCount = hasChildren ? countSubtreeTodos(todos, todo.id, showCompleted) : 0;

    return (
      <ScaleDecorator>
        <View
          style={[
            styles.todoListItem,
            {
              opacity: todo.completed ? 0.6 : 1,
              backgroundColor: isActive ? theme.accentSoft : 'transparent',
            },
          ]}
        >
          <View style={styles.todoCardRow}>
            <View style={styles.todoFixedControls}>
              <TouchableOpacity
                onLongPress={drag}
                delayLongPress={120}
                style={styles.todoDragHandle}
              >
                <Text style={[styles.todoDragHandleText, { color: theme.mutedText }]}>{'\u2261'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.todoCheckButton,
                  {
                    borderColor: todo.completed ? theme.accent : theme.border,
                    backgroundColor: todo.completed ? theme.accentSoft : 'transparent',
                  },
                ]}
                onPress={() => onToggleTodo(todo.id)}
              >
                <Text style={[styles.todoCheckMark, { color: todo.completed ? theme.accent : theme.mutedText }]}>
                  {todo.completed ? '\u2713' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {renderNestingGutter(depth)}

            <View style={styles.todoRowBody}>
              <View style={styles.todoTitleRow}>
                {hasChildren ? (
                  <TouchableOpacity
                    style={styles.todoCollapseButton}
                    onPress={() => toggleSubtree(todo.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Text style={[styles.todoCollapseIcon, { color: theme.mutedText }]}>
                      {isSubtreeCollapsed ? '\u25B6' : '\u25BC'}
                    </Text>
                    {isSubtreeCollapsed ? (
                      <Text style={[styles.todoCollapseCount, { color: theme.mutedText }]}>
                        {childCount}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.todoCollapseSpacer} />
                )}
                <TouchableOpacity
                  style={styles.todoTitleButton}
                  onPress={() => toggleEditing(todo)}
                  onLongPress={() => handleDeleteTodo(todo.id)}
                  delayLongPress={450}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.todoTaskTitle,
                      {
                        color: isEditing ? theme.accent : theme.text,
                        textDecorationLine: todo.completed ? 'line-through' : 'none',
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {isEditing ? editTitle || 'Untitled' : todo.title}
                  </Text>
                </TouchableOpacity>
                <View style={styles.todoTitleActions}>
                  <TouchableOpacity
                    style={styles.todoInlineIconButton}
                    onPress={() => toggleEditing(todo)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Text style={[styles.todoEditIconText, { color: isEditing ? theme.accent : theme.mutedText }]}>{'\u270E'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.todoInlineIconButton}
                    onPress={() => handleAddSubTodo(todo.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={[styles.todoEditIconText, { color: theme.mutedText }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {isEditing ? renderInlineEditPanel(todo) : null}
        </View>
      </ScaleDecorator>
    );
  };

  const listHeader = (
    <View>
      <Text style={[styles.formTitle, { color: theme.text }]}>Todos</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Tap a title to edit. Long-press a title to delete. Changes save automatically.
      </Text>

      <TouchableOpacity
        style={[
          styles.secondaryButton,
          {
            backgroundColor: showCompleted ? theme.accentSoft : theme.secondaryBackground,
            borderWidth: 1,
            borderColor: showCompleted ? theme.accent : theme.border,
            marginBottom: 12,
            opacity: completedCount > 0 ? 1 : 0.55,
          },
        ]}
        onPress={() => completedCount > 0 && setShowCompleted(current => !current)}
        disabled={completedCount === 0}
      >
        <Text style={[styles.secondaryButtonText, { color: showCompleted ? theme.accent : theme.secondaryButtonText }]}>
          {showCompleted ? 'Hide Completed Items' : 'Show Completed Items'}
          {completedCount > 0 ? ` (${completedCount})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const listEmpty = (
    <Text style={[styles.emptyText, { color: theme.mutedText, marginTop: 40 }]}>
      {todos.length === 0
        ? 'No todos yet. Use Quick Capture in Todo List mode to create some.'
        : openCount === 0 && !showCompleted
          ? 'All tasks are complete. Tap Show Completed Items to review them.'
          : 'No todos match this view.'}
    </Text>
  );

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background, flex: 1 }]}>
      <DraggableFlatList
        data={listData}
        keyExtractor={item => item.todo.id}
        onDragEnd={({ data, from, to }) => {
          setListData(data);
          void onReorderTodos(data, from, to);
        }}
        activationDistance={12}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={[styles.mainContent, { paddingBottom: 24 }]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        renderItem={renderTodoRow}
      />

      <TouchableOpacity style={styles.cancelButton} onPress={() => void handleBack()}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}