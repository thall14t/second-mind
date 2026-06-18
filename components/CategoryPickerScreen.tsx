import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { ManagedCategory } from '../types';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { formatCategoryLabel, getDirectChildren, isRangeCategory, isSubcategoryRange } from '../utils/antinet';

interface CategoryPickerScreenProps {
  darkMode: boolean;
  categories: ManagedCategory[];
  expandedCategories: Record<string, boolean>;
  onToggleCategory: (id: string) => void;
  onSelectCategory: (category: ManagedCategory) => void;
  onCreateSubcategory: (category: ManagedCategory) => void;
  onManageCategory: (category: ManagedCategory) => void;
  onBack: () => void;
}

export default function CategoryPickerScreen({
  darkMode,
  categories,
  expandedCategories,
  onToggleCategory,
  onSelectCategory,
  onCreateSubcategory,
  onManageCategory,
  onBack,
}: CategoryPickerScreenProps) {
  const theme = getTheme(darkMode);
  const cardShadow = darkMode
    ? { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 }
    : { shadowColor: theme.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 };

  const renderCategory = (category: ManagedCategory, level = 0): React.ReactNode => {
    const isExpanded = expandedCategories[category.id] || false;
    const children = getDirectChildren(category);
    const hasChildren = children.length > 0;
    const canCreateSubcategory = isRangeCategory(category) && isSubcategoryRange(category);
    const canExpand = isRangeCategory(category);

    return (
      <View key={category.id} style={{ paddingLeft: level * 16 }}>
        <View style={styles.categoryRow}>
          <TouchableOpacity
            style={[
              styles.categoryItem,
              cardShadow,
              {
                flex: 1,
                backgroundColor: theme.cardBackground,
                borderLeftColor: level === 0 ? theme.accent : theme.border,
              },
            ]}
            onPress={() => (canExpand ? onToggleCategory(category.id) : onSelectCategory(category))}
            onLongPress={() => onManageCategory(category)}
          >
            <Text style={[styles.categoryText, { color: theme.text }]}>
              {formatCategoryLabel(category.range, category.title)}
            </Text>
          </TouchableOpacity>

          {canCreateSubcategory && (
            <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={() => onCreateSubcategory(category)}>
              <Text style={[styles.addButtonText, { color: theme.primaryButtonText }]}>+</Text>
            </TouchableOpacity>
          )}

          {canExpand && (
            <TouchableOpacity style={styles.chevronButton} onPress={() => onToggleCategory(category.id)}>
              <Text style={[styles.chevron, { color: theme.text }]}>{isExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isExpanded && hasChildren &&
          children.map(child => renderCategory(child, level + 1))
        }

        {isExpanded && !hasChildren && canExpand && (
          <Text style={[styles.emptyRangeText, { paddingLeft: (level + 1) * 16, color: theme.mutedText }]}>
            No categories here yet. Use + to add one.
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Choose Category</Text>
      <Text style={[styles.helperText, { color: theme.mutedText }]}>Tap to open. Long-press a category to edit it. Only leaf categories can be deleted.</Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <>{renderCategory(item)}</>}
        style={styles.categoryList}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
