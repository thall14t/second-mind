import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Todo } from '../types';
import { buildTodoTree, canMoveTodo, TodoTreeNode } from '../utils/todoTree';

interface TodoListScreenProps {
  darkMode: boolean;
  todos: Todo[];
  onToggleTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddSubTodo: (parentId: string) => void;
  onUpdateTodo: (todoId: string, updates: { title: string; content?: string }) => void | Promise<void>;
  onMoveTodo: (todoId: string, direction: 'up' | 'down') => void | Promise<void>;
  onBack: () => void;
}

export default function TodoListScreen({
  darkMode,
  todos,
  onToggleTodo,
  onDeleteTodo,
  onAddSubTodo,
  onUpdateTodo,
  onMoveTodo,
  onBack,
}: TodoListScreenProps) {
  const theme = getTheme(darkMode);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const tree = useMemo(() => buildTodoTree(todos), [todos]);
  const editingTodo = editingTodoId ? todos.find(todo => todo.id === editingTodoId) ?? null : null;

  useEffect(() => {
    if (!editingTodo) {
      setEditTitle('');
      setEditContent('');
      return;
    }

    setEditTitle(editingTodo.title);
    setEditContent(editingTodo.content ?? '');
  }, [editingTodo]);

  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditTitle(todo.title);
    setEditContent(todo.content ?? '');
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditTitle('');
    setEditContent('');
  };

  const saveEditing = async () => {
    if (!editingTodoId) {
      return;
    }

    await onUpdateTodo(editingTodoId, {
      title: editTitle,
      content: editContent,
    });
    cancelEditing();
  };

  const renderTodoRow = (node: TodoTreeNode) => {
    const { todo, depth, children } = node;
    const indent = depth * 18;
    const canMoveUp = canMoveTodo(todos, todo.id, 'up');
    const canMoveDown = canMoveTodo(todos, todo.id, 'down');
    const isEditing = editingTodoId === todo.id;

    return (
      <View key={todo.id}>
        <View
          style={[
            styles.inboxCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: isEditing ? theme.accent : theme.border,
              marginLeft: indent,
              opacity: todo.completed ? 0.65 : 1,
            },
          ]}
        >
          <View style={styles.todoCardRow}>
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
              {todo.content ? (
                <Text style={[styles.inboxPreview, { color: theme.mutedText }]} numberOfLines={4}>
                  {todo.content}
                </Text>
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
                      opacity: canMoveUp ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => canMoveUp && onMoveTodo(todo.id, 'up')}
                  disabled={!canMoveUp}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inboxActionButton,
                    {
                      backgroundColor: theme.secondaryBackground,
                      borderWidth: 1,
                      borderColor: theme.border,
                      opacity: canMoveDown ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => canMoveDown && onMoveTodo(todo.id, 'down')}
                  disabled={!canMoveDown}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Down</Text>
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

        {children.map(child => renderTodoRow(child))}
      </View>
    );
  };

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Todos</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Nested tasks with edit, reorder, and unlimited sub-levels.
      </Text>

      {editingTodo ? (
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
      ) : null}

      {tree.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>
          No todos yet. Use Quick Capture in Todo List mode to create some.
        </Text>
      ) : (
        tree.map(node => renderTodoRow(node))
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}