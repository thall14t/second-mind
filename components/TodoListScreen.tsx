import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Todo } from '../types';

interface TodoListScreenProps {
  darkMode: boolean;
  todos: Todo[];
  onToggleTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddSubTodo: (parentId: string) => void;
  onBack: () => void;
}

export default function TodoListScreen({
  darkMode,
  todos,
  onToggleTodo,
  onDeleteTodo,
  onAddSubTodo,
  onBack,
}: TodoListScreenProps) {
  const theme = getTheme(darkMode);

  const { parents, childrenByParentId } = useMemo(() => {
    const parentTodos = todos.filter(todo => !todo.parentId);
    const childMap = new Map<string, Todo[]>();

    for (const todo of todos) {
      if (!todo.parentId) {
        continue;
      }
      const siblings = childMap.get(todo.parentId) ?? [];
      siblings.push(todo);
      childMap.set(todo.parentId, siblings);
    }

    return { parents: parentTodos, childrenByParentId: childMap };
  }, [todos]);

  const renderTodoRow = (todo: Todo, isChild = false) => (
    <View
      key={todo.id}
      style={[
        styles.inboxCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          marginLeft: isChild ? 20 : 0,
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
          <Text style={[styles.inboxPreview, { color: theme.mutedText }]} numberOfLines={3}>
            {todo.content}
          </Text>
        ) : null}

        <View style={styles.inboxActionRow}>
          {!isChild ? (
            <TouchableOpacity
              style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => onAddSubTodo(todo.id)}
            >
              <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>+ Sub</Text>
            </TouchableOpacity>
          ) : null}
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
  );

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Todos</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Nested tasks captured from Quick Capture or converted from your inbox.
      </Text>

      {parents.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>
          No todos yet. Use Quick Capture in Todo List mode to create some.
        </Text>
      ) : (
        parents.map(parent => (
          <View key={parent.id}>
            {renderTodoRow(parent)}
            {(childrenByParentId.get(parent.id) ?? []).map(child => renderTodoRow(child, true))}
          </View>
        ))
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}