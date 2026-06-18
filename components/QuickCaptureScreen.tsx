import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';

interface QuickCaptureScreenProps {
  darkMode: boolean;
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function QuickCaptureScreen({
  darkMode,
  title,
  content,
  onTitleChange,
  onContentChange,
  onSave,
  onCancel,
}: QuickCaptureScreenProps) {
  const theme = getTheme(darkMode);

  return (
    <View style={[styles.cardForm, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Quick Capture</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Drop a rough note, quote, task list, or idea in one place. Second Mind will route it in the background to your library or todos.
      </Text>

      <Text style={[styles.label, { color: theme.subtleText }]}>Title Optional</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={title}
        onChangeText={onTitleChange}
        placeholder="A short handle for the thought"
        placeholderTextColor={theme.mutedText}
      />

      <Text style={[styles.label, { color: theme.subtleText }]}>Capture</Text>
      <TextInput
        style={[styles.input, styles.quickCaptureInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={content}
        onChangeText={onContentChange}
        placeholder={'Paste or dictate anything — ideas, quotes, errands, or lists like:\n- Buy milk\n- Call dentist'}
        placeholderTextColor={theme.mutedText}
        multiline
        numberOfLines={10}
      />

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={onSave}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>Capture</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}