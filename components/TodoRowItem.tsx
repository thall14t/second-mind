import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Todo } from '../types';
import { FlatTodoItem } from '../utils/todoTree';

const SWIPE_THRESHOLD = 40;
const SWIPE_ACTIVATION_OFFSET = 12;
const TAP_MAX_DISTANCE = 10;
const DOUBLE_TAP_MS = 320;

interface TodoRowItemProps {
  params: RenderItemParams<FlatTodoItem>;
  theme: ReturnType<typeof getTheme>;
  editingTodoId: string | null;
  editingDetailsExpanded: boolean;
  editTitle: string;
  editContent: string;
  editDueDate: string;
  editRelatedAddressesText: string;
  hasChildren: boolean;
  isSubtreeCollapsed: boolean;
  childCount: number;
  canIndent: boolean;
  canOutdent: boolean;
  onToggleTodo: (todoId: string) => void;
  onIndentTodo: (todoId: string) => void;
  onOutdentTodo: (todoId: string) => void;
  onToggleSubtree: (todoId: string) => void;
  onOpenEditing: (todo: Todo) => void;
  onZoomIntoTodo: (todoId: string) => void;
  onTodoLongPress: (todo: Todo) => void;
  onTitleSubmit: (todo: Todo) => void;
  onEditTitleChange: (value: string) => void;
  onEditingFieldFocus: (todoId: string) => void;
  onEditingFieldBlur: (todoId: string) => void;
  renderNestingGutter: (depth: number) => React.ReactNode;
  renderDetailsPanel: (todo: Todo) => React.ReactNode;
}

export default function TodoRowItem({
  params,
  theme,
  editingTodoId,
  editingDetailsExpanded,
  editTitle,
  editContent,
  editDueDate,
  editRelatedAddressesText,
  hasChildren,
  isSubtreeCollapsed,
  childCount,
  canIndent,
  canOutdent,
  onToggleTodo,
  onIndentTodo,
  onOutdentTodo,
  onToggleSubtree,
  onOpenEditing,
  onZoomIntoTodo,
  onTodoLongPress,
  onTitleSubmit,
  onEditTitleChange,
  onEditingFieldFocus,
  onEditingFieldBlur,
  renderNestingGutter,
  renderDetailsPanel,
}: TodoRowItemProps) {
  const { item, drag, isActive } = params;
  const { todo, depth } = item;
  const isEditing = editingTodoId === todo.id;
  const showDetails = isEditing && editingDetailsExpanded;

  const rowGestures = useMemo(() => {
    if (isEditing) {
      return Gesture.Manual();
    }

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_MS)
      .maxDistance(TAP_MAX_DISTANCE)
      .onEnd(() => {
        if (hasChildren) {
          runOnJS(onZoomIntoTodo)(todo.id);
        }
      });

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .maxDistance(TAP_MAX_DISTANCE)
      .onEnd(() => {
        runOnJS(onOpenEditing)(todo);
      });

    const longPress = Gesture.LongPress()
      .minDuration(450)
      .onEnd(() => {
        runOnJS(onTodoLongPress)(todo);
      });

    const titleGestures = Gesture.Exclusive(
      longPress,
      Gesture.Exclusive(doubleTap, singleTap)
    );

    const swipePan = Gesture.Pan()
      .activeOffsetX([-SWIPE_ACTIVATION_OFFSET, SWIPE_ACTIVATION_OFFSET])
      .failOffsetY([-24, 24])
      .onEnd(event => {
        if (event.translationX >= SWIPE_THRESHOLD && canIndent) {
          runOnJS(onIndentTodo)(todo.id);
          return;
        }

        if (event.translationX <= -SWIPE_THRESHOLD && canOutdent) {
          runOnJS(onOutdentTodo)(todo.id);
        }
      });

    return Gesture.Exclusive(swipePan, titleGestures);
  }, [
    canIndent,
    canOutdent,
    hasChildren,
    onTodoLongPress,
    onIndentTodo,
    onOpenEditing,
    onOutdentTodo,
    onZoomIntoTodo,
    isEditing,
    todo,
  ]);

  const renderBullet = () => {
    if (!hasChildren) {
      return (
        <View style={styles.todoBulletSpacer}>
          <View style={[styles.todoBulletLeaf, { backgroundColor: theme.mutedText, opacity: 0.45 }]} />
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.todoBulletButton}
        onPress={() => onToggleSubtree(todo.id)}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        <View
          style={[
            styles.todoBullet,
            {
              borderColor: theme.accent,
              backgroundColor: isSubtreeCollapsed ? theme.accent : 'transparent',
            },
          ]}
        />
        {isSubtreeCollapsed ? (
          <Text style={[styles.todoBulletCount, { color: theme.mutedText }]}>{childCount}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

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
          <TouchableOpacity
            style={[
              styles.todoCheckButton,
              {
                borderColor: todo.completed ? theme.accent : theme.border,
                backgroundColor: todo.completed ? theme.accentSoft : 'transparent',
              },
            ]}
            onPress={() => onToggleTodo(todo.id)}
            onLongPress={drag}
            delayLongPress={180}
          >
            <Text style={[styles.todoCheckMark, { color: todo.completed ? theme.accent : theme.mutedText }]}>
              {todo.completed ? '\u2713' : ''}
            </Text>
          </TouchableOpacity>

          {renderNestingGutter(depth)}

          <GestureDetector gesture={rowGestures}>
            <View style={styles.todoRowBody}>
              <View style={styles.todoTitleRow}>
                {renderBullet()}

                <View style={styles.todoTitleButton}>
                  {isEditing ? (
                    <TextInput
                      style={[
                        styles.todoTitleInput,
                        {
                          color: theme.text,
                          borderColor: theme.border,
                          backgroundColor: theme.cardBackground,
                        },
                      ]}
                      value={editTitle}
                      onChangeText={onEditTitleChange}
                      onFocus={() => onEditingFieldFocus(todo.id)}
                      onBlur={() => onEditingFieldBlur(todo.id)}
                      placeholder="Task"
                      placeholderTextColor={theme.mutedText}
                      onSubmitEditing={() => { void onTitleSubmit(todo); }}
                      blurOnSubmit={false}
                      returnKeyType="next"
                      autoFocus
                    />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.todoTaskTitle,
                          {
                            color: theme.text,
                            textDecorationLine: todo.completed ? 'line-through' : 'none',
                          },
                        ]}
                        numberOfLines={3}
                      >
                        {todo.title || 'Untitled'}
                      </Text>
                      {todo.content ? (
                        <Text style={[styles.todoInlineNote, { color: theme.mutedText }]} numberOfLines={1}>
                          {todo.content}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            </View>
          </GestureDetector>
        </View>

        {showDetails ? renderDetailsPanel(todo) : null}
      </View>
    </ScaleDecorator>
  );
}