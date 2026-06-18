import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';

export type QuickCaptureType = 'card' | 'todo';

interface QuickCaptureScreenProps {
  darkMode: boolean;
  captureType: QuickCaptureType;
  title: string;
  content: string;
  onCaptureTypeChange: (type: QuickCaptureType) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const CAPTURE_TYPES: Array<{ value: QuickCaptureType; label: string }> = [
  { value: 'card', label: 'Card Idea' },
  { value: 'todo', label: 'Todo List' },
];

export default function QuickCaptureScreen({
  darkMode,
  captureType,
  title,
  content,
  onCaptureTypeChange,
  onTitleChange,
  onContentChange,
  onSave,
  onCancel,
}: QuickCaptureScreenProps) {
  const theme = getTheme(darkMode);
  const isTodoMode = captureType === 'todo';

  return (
    <View style={[styles.cardForm, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Quick Capture</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        {isTodoMode
          ? 'Capture a todo list in rough form. Use bullets or numbered lines for sub-tasks — they will be parsed into nested todos on save.'
          : 'Drop the quote, idea, and source clues into one rough capture. You can cleanly split it into card fields from the inbox later.'}
      </Text>

      <Text style={[styles.label, { color: theme.subtleText }]}>Capture Type</Text>
      <View style={styles.segmentedRow}>
        {CAPTURE_TYPES.map(option => {
          const isActive = captureType === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.segmentedButton,
                {
                  backgroundColor: isActive ? theme.accentSoft : theme.cardBackground,
                  borderColor: isActive ? theme.accent : theme.border,
                },
              ]}
              onPress={() => onCaptureTypeChange(option.value)}
            >
              <Text style={[styles.segmentedButtonText, { color: isActive ? theme.accent : theme.text }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: theme.subtleText }]}>
        {isTodoMode ? 'List Title Optional' : 'Title Optional'}
      </Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={title}
        onChangeText={onTitleChange}
        placeholder={isTodoMode ? 'Parent task or list name' : 'A short handle for the thought'}
        placeholderTextColor={theme.mutedText}
      />

      <Text style={[styles.label, { color: theme.subtleText }]}>Capture</Text>
      <TextInput
        style={[styles.input, styles.quickCaptureInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={content}
        onChangeText={onContentChange}
        placeholder={
          isTodoMode
            ? 'Main task on the first line, then sub-tasks like:\n- Buy milk\n- Call dentist\n2. Review notes'
            : 'Paste or dictate the quote, idea, and source details all in one place...'
        }
        placeholderTextColor={theme.mutedText}
        multiline
        numberOfLines={10}
      />

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={onSave}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>
          {isTodoMode ? 'Save Todos' : 'Save to Capture Inbox'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}