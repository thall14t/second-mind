import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Todo } from '../types';
import { formatTodoDueDate } from '../utils/todoDates';
import {
  canIndentTodo,
  canOutdentTodo,
  FlatTodoItem,
  flattenTodoTree,
} from '../utils/todoTree';

interface TodoListScreenProps {
  darkMode: boolean;
  todos: Todo[];
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
    }
  ) => void | Promise<void>;
  onReorderTodos: (flat: FlatTodoItem[], from: number, to: number) => void | Promise<void>;
  onIndentTodo: (todoId: string) => void | Promise<void>;
  onOutdentTodo: (todoId: string) => void | Promise<void>;
  onOpenLinkedCard: (address: string) => void;
  onBack: () => void;
}

export default function TodoListScreen({
  darkMode,
  todos,
  onToggleTodo,
  onDeleteTodo,
  onAddSubTodo,
  onUpdateTodo,
  onReorderTodos,
  onIndentTodo,
  onOutdentTodo,
  onOpenLinkedCard,
  onBack,
}: TodoListScreenProps) {
  const theme = getTheme(darkMode);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRelatedAddressesText, setEditRelatedAddressesText] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const flatItems = useMemo(() => flattenTodoTree(todos), [todos]);
  const [listData, setListData] = useState(flatItems);
  const editingTodo = editingTodoId ? todos.find(todo => todo.id === editingTodoId) ?? null : null;

  useEffect(() => {
    setListData(flatItems);
  }, [flatItems]);

  useEffect(() => {
    if (!editingTodo) {
      setEditTitle('');
      setEditContent('');
      setEditRelatedAddressesText('');
      setEditDueDate('');
      return;
    }

    setEditTitle(editingTodo.title);
    setEditContent(editingTodo.content ?? '');
    setEditRelatedAddressesText((editingTodo.relatedAddresses ?? []).join(', '));
    setEditDueDate(editingTodo.dueDate ?? '');
  }, [editingTodo]);

  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditTitle(todo.title);
    setEditContent(todo.content ?? '');
    setEditRelatedAddressesText((todo.relatedAddresses ?? []).join(', '));
    setEditDueDate(todo.dueDate ?? '');
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
  };

  const saveEditing = async () => {
    if (!editingTodoId) {
      return;
    }

    await onUpdateTodo(editingTodoId, {
      title: editTitle,
      content: editContent,
      relatedAddressesText: editRelatedAddressesText,
      dueDate: editDueDate,
    });
    cancelEditing();
  };

  const renderEditPanel = () => {
    if (!editingTodo) {
      return null;
    }

    return (
      <View style={[styles.todoEditPanel, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}>
        <Text style={[styles.sourcePanelTitle, { color: theme.secondaryButtonText }]}>Edit Task</Text>

        <Text style={[styles.label, { color: theme.subtleText }]}>Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder="Task title"
          placeholderTextColor={theme.mutedText}
        />

        <Text style={[styles.label, { color: theme.subtleText }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.quickCaptureInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editContent}
          onChangeText={setEditContent}
          placeholder="Optional notes"
          placeholderTextColor={theme.mutedText}
          multiline
          numberOfLines={4}
        />

        <Text style={[styles.label, { color: theme.subtleText }]}>Due Date</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editDueDate}
          onChangeText={setEditDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: theme.subtleText }]}>Linked Cards</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={editRelatedAddressesText}
          onChangeText={setEditRelatedAddressesText}
          placeholder="e.g. 0101a, 0102b"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
        />

        <View style={styles.inboxActionRow}>
          <TouchableOpacity
            style={[styles.inboxActionButton, { backgroundColor: theme.primaryButton }]}
            onPress={saveEditing}
          >
            <Text style={[styles.inboxActionButtonText, { color: theme.primaryButtonText }]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
            onPress={cancelEditing}
          >
            <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTodoRow = ({ item, drag, isActive }: RenderItemParams<FlatTodoItem>) => {
    const { todo, depth } = item;
    const indent = depth * 18;
    const dueDateLabel = formatTodoDueDate(todo.dueDate);
    const isEditing = editingTodoId === todo.id;
    const showIndent = canIndentTodo(todos, todo.id);
    const showOutdent = canOutdentTodo(todos, todo.id);

    return (
      <ScaleDecorator>
        <View
          style={[
            styles.inboxCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: isEditing ? theme.accent : theme.border,
              marginLeft: indent,
              marginBottom: 14,
              opacity: todo.completed ? 0.65 : 1,
            },
            isActive && { borderColor: theme.accent, shadowOpacity: 0.2 },
          ]}
        >
          <View style={styles.todoCardRow}>
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={120}
              style={[
                styles.todoDragHandle,
                { borderColor: theme.border, backgroundColor: theme.tertiaryBackground },
              ]}
            >
              <Text style={[styles.todoDragHandleText, { color: theme.mutedText }]}>{'\u2261'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.todoCheckButton,
                {
                  borderColor: todo.completed ? theme.accent : theme.border,
                  backgroundColor: todo.completed ? theme.accentSoft : theme.cardBackground,
                },
              ]}
              onPress={() => onToggleTodo(todo.id)}
            >
              <Text style={[styles.todoCheckMark, { color: todo.completed ? theme.accent : theme.mutedText }]}>
                {todo.completed ? '\u2713' : ''}
              </Text>
            </TouchableOpacity>

            <View style={styles.todoRowBody}>
              <Text
                style={[
                  styles.inboxTitle,
                  {
                    color: theme.text,
                    textDecorationLine: todo.completed ? 'line-through' : 'none',
                  },
                ]}
              >
                {todo.title}
              </Text>

              {dueDateLabel ? (
                <View style={styles.todoMetaRow}>
                  <View style={[styles.todoMetaPill, { borderColor: theme.border, backgroundColor: theme.accentSoft }]}>
                    <Text style={[styles.todoMetaPillText, { color: theme.secondaryButtonText }]}>Due {dueDateLabel}</Text>
                  </View>
                </View>
              ) : null}

              {todo.content ? (
                <Text style={[styles.inboxPreview, { color: theme.mutedText }]} numberOfLines={4}>
                  {todo.content}
                </Text>
              ) : null}

              {(todo.relatedAddresses ?? []).length > 0 ? (
                <View style={styles.todoMetaRow}>
                  {(todo.relatedAddresses ?? []).map(address => (
                    <TouchableOpacity
                      key={`${todo.id}-${address}`}
                      style={[styles.todoLinkedCardButton, { borderColor: theme.border, backgroundColor: theme.tertiaryBackground }]}
                      onPress={() => onOpenLinkedCard(address)}
                    >
                      <Text style={[styles.todoLinkedCardText, { color: theme.secondaryButtonText }]}>{address}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View style={styles.inboxActionRow}>
                <TouchableOpacity
                  style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => startEditing(todo)}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => onAddSubTodo(todo.id)}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>+ Sub</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inboxActionRow}>
                <TouchableOpacity
                  style={[
                    styles.inboxActionButton,
                    {
                      backgroundColor: theme.secondaryBackground,
                      borderWidth: 1,
                      borderColor: theme.border,
                      opacity: showIndent ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => showIndent && onIndentTodo(todo.id)}
                  disabled={!showIndent}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Indent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inboxActionButton,
                    {
                      backgroundColor: theme.secondaryBackground,
                      borderWidth: 1,
                      borderColor: theme.border,
                      opacity: showOutdent ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => showOutdent && onOutdentTodo(todo.id)}
                  disabled={!showOutdent}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Outdent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => onDeleteTodo(todo.id)}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  const listHeader = (
    <View>
      <Text style={[styles.formTitle, { color: theme.text }]}>Todos</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Long-press the handle to drag. Drag down onto a task to nest it. Use Indent/Outdent to reparent.
      </Text>
      {renderEditPanel()}
    </View>
  );

  const listEmpty = (
    <Text style={[styles.emptyText, { color: theme.mutedText, marginTop: 40 }]}>
      No todos yet. Use Quick Capture in Todo List mode to create some.
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

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}