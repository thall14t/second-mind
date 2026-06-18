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
  onSaveToInbox: () => void;
  onCancel: () => void;
}

export default function QuickCaptureScreen({
  darkMode,
  title,
  content,
  onTitleChange,
  onContentChange,
  onSaveToInbox,
  onCancel,
}: QuickCaptureScreenProps) {
  const theme = getTheme(darkMode);

  return (
    <View style={[styles.cardForm, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Quick Capture</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Drop the quote, idea, and source clues into one rough capture. You can cleanly split it into card fields from the inbox later.
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
        placeholder="Paste or dictate the quote, idea, and source details all in one place..."
        placeholderTextColor={theme.mutedText}
        multiline
        numberOfLines={10}
      />

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={onSaveToInbox}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>Save to Capture Inbox</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
