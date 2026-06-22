import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import TodoRowItem from './TodoRowItem';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Todo } from '../types';
import { normalizeTodoDueDateInput } from '../utils/todoDates';
import {
  buildAutoCollapsedParentIds,
  canIndentTodo,
  canOutdentTodo,
  collectDescendantIds,
  countCompletedTodos,
  countSubtreeTodos,
  FlatTodoItem,
  flattenTodoTree,
  getTodoAncestorChain,
  projectTodosForZoom,
  todoHasChildren,
} from '../utils/todoTree';

const TODO_NEST_STEP = 10;
const TODO_MAX_NEST_GUIDES = 5;
const AUTO_SAVE_DELAY_MS = 600;
const COLLAPSE_SAVE_DELAY_MS = 300;
const KEYBOARD_SCROLL_VIEW_POSITION = 0.28;
const EDIT_BLUR_DISMISS_DELAY_MS = 100;


interface TodoListScreenProps {
  darkMode: boolean;
  todos: Todo[];
  collapsedTodoIds: string[];
  onToggleTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddSubTodo: (parentId: string, title?: string) => Promise<string>;
  onAddSiblingTodo: (afterTodoId: string, title?: string) => Promise<string | null>;
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
  onZoomChange?: (isZoomed: boolean) => void;
  onRegisterZoomOut?: (handler: (() => void) | null) => void;
  onBack: () => void;
}

export default function TodoListScreen({
  darkMode,
  todos,
  collapsedTodoIds,
  onToggleTodo,
  onDeleteTodo,
  onAddSubTodo,
  onAddSiblingTodo,
  onUpdateTodo,
  onCollapsedTodoIdsChange,
  onReorderTodos,
  onIndentTodo,
  onOutdentTodo,
  onOpenLinkedCard,
  onZoomChange,
  onRegisterZoomOut,
  onBack,
}: TodoListScreenProps) {
  const theme = getTheme(darkMode);
  const [showCompleted, setShowCompleted] = useState(false);
  const [zoomedTodoId, setZoomedTodoId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(collapsedTodoIds));
  const collapsePersistReadyRef = useRef(false);
  const autoCollapseBootstrappedRef = useRef(false);

  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRelatedAddressesText, setEditRelatedAddressesText] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editingDetailsExpanded, setEditingDetailsExpanded] = useState(false);

  const displayTodos = useMemo(
    () => (zoomedTodoId ? projectTodosForZoom(todos, zoomedTodoId) : todos),
    [todos, zoomedTodoId]
  );

  const completedCount = useMemo(() => countCompletedTodos(todos), [todos]);
  const openCount = todos.length - completedCount;
  const flatItems = useMemo(
    () => flattenTodoTree(displayTodos, showCompleted, collapsedIds),
    [displayTodos, showCompleted, collapsedIds]
  );
  const [listData, setListData] = useState(flatItems);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef<FlatList<FlatTodoItem>>(null);
  const pendingEditDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingTodoIdRef = useRef<string | null>(null);
  const editingRowSwitchRef = useRef(false);
  editingTodoIdRef.current = editingTodoId;
  const editingTodo = editingTodoId ? todos.find(todo => todo.id === editingTodoId) ?? null : null;
  const zoomBreadcrumb = useMemo(
    () => (zoomedTodoId ? getTodoAncestorChain(todos, zoomedTodoId) : []),
    [todos, zoomedTodoId]
  );

  useEffect(() => {
    setListData(flatItems);
  }, [flatItems]);

  useEffect(() => {
    onZoomChange?.(zoomedTodoId !== null);
  }, [onZoomChange, zoomedTodoId]);

  useEffect(() => {
    onRegisterZoomOut?.(() => {
      setZoomedTodoId(null);
    });
    return () => onRegisterZoomOut?.(null);
  }, [onRegisterZoomOut]);

  useEffect(() => {
    setCollapsedIds(new Set(collapsedTodoIds));
    collapsePersistReadyRef.current = false;
  }, [collapsedTodoIds]);

  useEffect(() => {
    if (autoCollapseBootstrappedRef.current) {
      return;
    }

    if (collapsedTodoIds.length > 0) {
      autoCollapseBootstrappedRef.current = true;
      return;
    }

    const defaults = buildAutoCollapsedParentIds(todos, true);
    autoCollapseBootstrappedRef.current = true;
    if (defaults.length === 0) {
      return;
    }

    setCollapsedIds(new Set(defaults));
    void onCollapsedTodoIdsChange(defaults);
  }, [collapsedTodoIds.length, onCollapsedTodoIdsChange, todos]);

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
    if (!editingTodoId || !zoomedTodoId) {
      return;
    }

    const visible = collectDescendantIds(todos, zoomedTodoId);
    if (!visible.has(editingTodoId)) {
      setEditingTodoId(null);
    }
  }, [editingTodoId, todos, zoomedTodoId]);

  useEffect(() => {
    if (!editingTodoId) {
      setEditTitle('');
      setEditContent('');
      setEditRelatedAddressesText('');
      setEditDueDate('');
      setEditingDetailsExpanded(false);
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
  }, [editingTodoId, todos]);

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

  const openEditing = (todo: Todo, options?: { expandDetails?: boolean }) => {
    setEditingDetailsExpanded(Boolean(options?.expandDetails));
    setEditingTodoId(todo.id);
  };

  const flushAndCollapseEditing = useCallback(async () => {
    await persistEditing();
    collapseEditing();
  }, [persistEditing]);

  const cancelPendingEditDismiss = useCallback(() => {
    if (pendingEditDismissRef.current) {
      clearTimeout(pendingEditDismissRef.current);
      pendingEditDismissRef.current = null;
    }
  }, []);

  const scheduleDismissEditing = useCallback((todoIdAtBlur: string) => {
    cancelPendingEditDismiss();
    pendingEditDismissRef.current = setTimeout(() => {
      pendingEditDismissRef.current = null;
      if (editingRowSwitchRef.current) {
        return;
      }
      if (editingTodoIdRef.current !== todoIdAtBlur) {
        return;
      }
      void flushAndCollapseEditing();
    }, EDIT_BLUR_DISMISS_DELAY_MS);
  }, [cancelPendingEditDismiss, flushAndCollapseEditing]);

  const handleBack = async () => {
    if (zoomedTodoId) {
      await flushAndCollapseEditing();
      setZoomedTodoId(null);
      return;
    }

    await flushAndCollapseEditing();
    onBack();
  };

  const zoomIntoTodo = (todoId: string) => {
    setZoomedTodoId(todoId);
    setCollapsedIds(current => {
      if (!current.has(todoId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(todoId);
      return next;
    });
  };

  const scrollEditingTodoIntoView = useCallback((todoId?: string | null) => {
    const targetId = todoId ?? editingTodoId;
    if (!targetId) {
      return;
    }

    const index = listData.findIndex(item => item.todo.id === targetId);
    if (index < 0) {
      return;
    }

    const scroll = () => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: KEYBOARD_SCROLL_VIEW_POSITION,
      });
    };

    requestAnimationFrame(() => {
      setTimeout(scroll, Platform.OS === 'ios' ? 80 : 120);
    });
  }, [editingTodoId, listData]);

  const handleEditingFieldFocus = useCallback((todoId: string) => {
    cancelPendingEditDismiss();
    scrollEditingTodoIntoView(todoId);
  }, [cancelPendingEditDismiss, scrollEditingTodoIntoView]);

  const handleEditingFieldBlur = useCallback((todoId: string) => {
    scheduleDismissEditing(todoId);
  }, [scheduleDismissEditing]);

  useEffect(() => {
    if (!editingTodoId) {
      return;
    }

    scrollEditingTodoIntoView(editingTodoId);
  }, [editingTodoId, scrollEditingTodoIntoView]);

  useEffect(() => () => {
    cancelPendingEditDismiss();
  }, [cancelPendingEditDismiss]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardInset(event.endCoordinates.height);
      if (editingTodoId) {
        scrollEditingTodoIntoView(editingTodoId);
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [editingTodoId, scrollEditingTodoIntoView]);

  const handleDeleteTodo = useCallback((todoId: string) => {
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
            if (zoomedTodoId === todoId) {
              setZoomedTodoId(null);
            }
            collapseEditing();
          },
        },
      ]
    );
  }, [onDeleteTodo, zoomedTodoId]);

  const handleOpenEditing = useCallback(async (todo: Todo, options?: { expandDetails?: boolean }) => {
    if (editingTodoId === todo.id) {
      if (options?.expandDetails) {
        setEditingDetailsExpanded(true);
      }
      return;
    }

    cancelPendingEditDismiss();
    editingRowSwitchRef.current = true;
    await persistEditing();
    openEditing(todo, options);
    setTimeout(() => {
      editingRowSwitchRef.current = false;
    }, EDIT_BLUR_DISMISS_DELAY_MS + 50);
  }, [cancelPendingEditDismiss, editingTodoId, persistEditing]);

  const handleTodoLongPress = useCallback((todo: Todo) => {
    Alert.alert(
      todo.title.trim() || 'Task',
      'Edit notes and due date, or delete this task.',
      [
        {
          text: 'Edit details',
          onPress: () => {
            void handleOpenEditing(todo, { expandDetails: true });
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            handleDeleteTodo(todo.id);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [handleDeleteTodo, handleOpenEditing]);

  const handleZoomIntoTodo = useCallback(async (todoId: string) => {
    await persistEditing();
    collapseEditing();
    zoomIntoTodo(todoId);
  }, [persistEditing]);

  const handleTitleSubmit = async (todo: Todo) => {
    await persistEditing(todo.id);

    let newTodoId: string | null = null;
    if (zoomedTodoId && todo.id === zoomedTodoId) {
      newTodoId = await onAddSubTodo(zoomedTodoId, '');
    } else {
      newTodoId = await onAddSiblingTodo(todo.id, '');
    }

    if (!newTodoId) {
      return;
    }

    setEditingTodoId(newTodoId);
    setEditTitle('');
    setEditContent('');
    setEditRelatedAddressesText('');
    setEditDueDate('');
    setEditingDetailsExpanded(false);
  };

  const toggleSubtree = (todoId: string) => {
    setCollapsedIds(current => {
      const next = new Set(current);
      const willCollapse = !next.has(todoId);

      if (willCollapse) {
        next.add(todoId);
        if (editingTodoId) {
          const hiddenIds = collectDescendantIds(displayTodos, todoId);
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

  const renderDetailsPanel = (todo: Todo) => (
    <View style={[styles.todoEditPanelInline, { backgroundColor: theme.tertiaryBackground, borderColor: theme.border }]}>
      <TextInput
        style={[styles.todoCompactInput, styles.todoCompactNotesInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={editContent}
        onChangeText={setEditContent}
        onFocus={() => handleEditingFieldFocus(todo.id)}
        onBlur={() => handleEditingFieldBlur(todo.id)}
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
          onFocus={() => handleEditingFieldFocus(todo.id)}
          onBlur={() => handleEditingFieldBlur(todo.id)}
          placeholder="Due YYYY-MM-DD"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.todoCompactInput, styles.todoCompactHalfInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editRelatedAddressesText}
          onChangeText={setEditRelatedAddressesText}
          onFocus={() => handleEditingFieldFocus(todo.id)}
          onBlur={() => handleEditingFieldBlur(todo.id)}
          placeholder="Cards 0101a"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
        />
      </View>

      {(todo.relatedAddresses ?? []).map(address => (
        <TouchableOpacity key={address} onPress={() => onOpenLinkedCard(address)}>
          <Text style={[styles.todoLinkedCardText, { color: theme.accent }]}>{address}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTodoRow = (params: RenderItemParams<FlatTodoItem>) => {
    const { todo } = params.item;
    const hasChildren = todoHasChildren(displayTodos, todo.id, showCompleted);
    const isSubtreeCollapsed = collapsedIds.has(todo.id);
    const childCount = hasChildren ? countSubtreeTodos(displayTodos, todo.id, showCompleted) : 0;

    return (
      <TodoRowItem
        params={params}
        theme={theme}
        editingTodoId={editingTodoId}
        editingDetailsExpanded={editingTodoId === todo.id && editingDetailsExpanded}
        editTitle={editTitle}
        editContent={editContent}
        editDueDate={editDueDate}
        editRelatedAddressesText={editRelatedAddressesText}
        hasChildren={hasChildren}
        isSubtreeCollapsed={isSubtreeCollapsed}
        childCount={childCount}
        canIndent={canIndentTodo(displayTodos, todo.id)}
        canOutdent={canOutdentTodo(displayTodos, todo.id)}
        onToggleTodo={onToggleTodo}
        onIndentTodo={todoId => { void onIndentTodo(todoId); }}
        onOutdentTodo={todoId => { void onOutdentTodo(todoId); }}
        onToggleSubtree={toggleSubtree}
        onOpenEditing={todoItem => { void handleOpenEditing(todoItem); }}
        onZoomIntoTodo={todoId => { void handleZoomIntoTodo(todoId); }}
        onTodoLongPress={handleTodoLongPress}
        onTitleSubmit={todoItem => { void handleTitleSubmit(todoItem); }}
        onEditTitleChange={setEditTitle}
        onEditingFieldFocus={handleEditingFieldFocus}
        onEditingFieldBlur={handleEditingFieldBlur}
        renderNestingGutter={renderNestingGutter}
        renderDetailsPanel={renderDetailsPanel}
      />
    );
  };

  const renderBreadcrumb = () => {
    if (zoomBreadcrumb.length === 0) {
      return null;
    }

    return (
      <View style={styles.todoZoomBreadcrumbRow}>
        <TouchableOpacity onPress={() => { void flushAndCollapseEditing(); setZoomedTodoId(null); }}>
          <Text style={[styles.todoZoomBreadcrumbLink, { color: theme.accent }]}>Todos</Text>
        </TouchableOpacity>
        {zoomBreadcrumb.map((item, index) => {
          const isLast = index === zoomBreadcrumb.length - 1;
          return (
            <React.Fragment key={item.id}>
              <Text style={[styles.todoZoomBreadcrumbSep, { color: theme.mutedText }]}>{'>'}</Text>
              {isLast ? (
                <Text style={[styles.todoZoomBreadcrumbCurrent, { color: theme.text }]} numberOfLines={1}>
                  {item.title || 'Untitled'}
                </Text>
              ) : (
                <TouchableOpacity onPress={() => { void flushAndCollapseEditing(); setZoomedTodoId(item.id); }}>
                  <Text style={[styles.todoZoomBreadcrumbLink, { color: theme.accent }]} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                </TouchableOpacity>
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  const listHeader = (
    <View>
      <View style={styles.todoHeaderRow}>
        <TouchableOpacity
          style={styles.todoHeaderBackButton}
          onPress={() => void handleBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.todoHeaderBackText, { color: theme.accent }]}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={[styles.formTitle, { color: theme.text, flex: 1, marginBottom: 0, textAlign: 'center' }]} numberOfLines={1}>
          {zoomedTodoId ? zoomBreadcrumb[zoomBreadcrumb.length - 1]?.title || 'Focused list' : 'Todos'}
        </Text>
      </View>
      {renderBreadcrumb()}
      <Pressable
        onPress={() => {
          if (editingTodoId) {
            void flushAndCollapseEditing();
          }
        }}
      >
        <Text style={[styles.contextText, { color: theme.mutedText }]}>
          Tap title to edit, bullet to fold, double-tap parent title to zoom. Swipe title right to indent, left to outdent. Long-press checkbox to reorder, title to delete. Swipe from the left edge to zoom out or go back.
        </Text>
      </Pressable>

      {completedCount > 0 ? (
        <TouchableOpacity
          onPress={() => setShowCompleted(current => !current)}
          style={{ marginBottom: 12 }}
        >
          <Text style={[styles.todoToggleLink, { color: theme.accent }]}>
            {showCompleted ? 'Hide completed' : `Show completed (${completedCount})`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const listEmpty = (
    <Text style={[styles.emptyText, { color: theme.mutedText, marginTop: 40 }]}>
      {displayTodos.length === 0
        ? 'No todos yet. Use Quick Capture to create some.'
        : openCount === 0 && !showCompleted
          ? 'All tasks are complete. Tap show completed above to review them.'
          : 'No todos match this view.'}
    </Text>
  );

  const listBottomPadding = keyboardInset > 0 ? keyboardInset + 24 : 24;

  return (
    <KeyboardAvoidingView
      style={[styles.fullScreenView, { backgroundColor: theme.background, flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <DraggableFlatList
        ref={listRef}
        data={listData}
        keyExtractor={item => item.todo.id}
        onDragEnd={({ data, from, to }) => {
          setListData(data);
          void onReorderTodos(data, from, to);
        }}
        activationDistance={12}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={[styles.mainContent, { paddingBottom: listBottomPadding }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          editingTodoId ? (
            <Pressable
              style={{ minHeight: 180 }}
              onPress={() => { void flushAndCollapseEditing(); }}
            />
          ) : null
        }
        renderItem={renderTodoRow}
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index),
            animated: true,
          });
          requestAnimationFrame(() => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: KEYBOARD_SCROLL_VIEW_POSITION,
              });
            }, 100);
          });
        }}
      />
    </KeyboardAvoidingView>
  );
}