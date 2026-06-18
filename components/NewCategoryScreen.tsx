import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ManagedCategory } from '../types';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { formatCategoryLabel } from '../utils/antinet';

interface NewCategoryScreenProps {
  mode?: 'create' | 'edit';
  darkMode: boolean;
  parentRange: ManagedCategory | null;
  isDefaultCategory?: boolean;
  canDelete?: boolean;
  address: string;
  title: string;
  onAddressChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export default function NewCategoryScreen({
  mode = 'create',
  darkMode,
  parentRange,
  isDefaultCategory = false,
  canDelete = true,
  address,
  title,
  onAddressChange,
  onTitleChange,
  onSave,
  onDelete,
  onCancel,
}: NewCategoryScreenProps) {
  const theme = getTheme(darkMode);

  return (
    <View style={[styles.cardForm, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>{mode === 'edit' ? 'Edit Category' : 'New Category'}</Text>
      {parentRange && (
        <Text style={[styles.contextText, { color: theme.mutedText }]}>
          Parent Range: {formatCategoryLabel(parentRange.range, parentRange.title)}
        </Text>
      )}

      <Text style={[styles.label, { color: theme.subtleText }]}>Category Address</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={address}
        onChangeText={onAddressChange}
        placeholder="e.g. 0103"
        placeholderTextColor={theme.mutedText}
        autoCapitalize="none"
        editable={!isDefaultCategory}
      />

      {isDefaultCategory && (
        <Text style={[styles.helperText, { color: theme.mutedText }]}>Default categories keep their original address. You can rename or hide them.</Text>
      )}

      <Text style={[styles.label, { color: theme.subtleText }]}>Category Title</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={title}
        onChangeText={onTitleChange}
        placeholder="e.g. Belief Formation"
        placeholderTextColor={theme.mutedText}
      />

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={onSave}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>{mode === 'edit' ? 'Save Changes' : 'Save Category'}</Text>
      </TouchableOpacity>

      {mode === 'edit' && onDelete && canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete Category</Text>
        </TouchableOpacity>
      )}

      {mode === 'edit' && !canDelete && (
        <Text style={[styles.helperText, { color: theme.mutedText }]}>Structural ranges can be edited, but they cannot be deleted.</Text>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
