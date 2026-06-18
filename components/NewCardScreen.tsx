import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { Card, CardFilingSuggestion, CardSourceType, FilingSuggestionStatus, ThinkingState } from '../types';
import { parseCommaSeparatedValues } from '../utils/antinet';
import ThinkingDots from './ThinkingDots';

interface NewCardScreenProps {
  mode?: 'create' | 'edit';
  darkMode: boolean;
  allCards: Card[];
  editingCardId?: string | null;
  address: string;
  title: string;
  content: string;
  status: 'Seed' | 'Growing' | 'Evergreen';
  tagsText: string;
  relatedAddressesText: string;
  sourceType: CardSourceType;
  sourceTitle: string;
  sourceAuthor: string;
  sourceUrl: string;
  sourcePage: string;
  sourceNote: string;
  aiSuggestion: CardFilingSuggestion | null;
  aiSuggestionStatus: FilingSuggestionStatus | null;
  isSuggestingFiling: boolean;
  aiThinkingState: ThinkingState | null;
  onAddressChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onStatusChange: (value: 'Seed' | 'Growing' | 'Evergreen') => void;
  onTagsChange: (value: string) => void;
  onRelatedAddressesChange: (value: string) => void;
  onSourceTypeChange: (value: CardSourceType) => void;
  onSourceTitleChange: (value: string) => void;
  onSourceAuthorChange: (value: string) => void;
  onSourceUrlChange: (value: string) => void;
  onSourcePageChange: (value: string) => void;
  onSourceNoteChange: (value: string) => void;
  onSuggestFiling: () => void;
  onSuggestDifferentFiling: () => void;
  onApplySuggestedFiling: () => void;
  onApplySuggestedDetails: () => void;
  onApplyAllAiSuggestion: () => void;
  onSelectAlternativeFiling: (index: number) => void;
  onDismissAiSuggestion: () => void;
  onChooseCategory: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export default function NewCardScreen({
  mode = 'create',
  darkMode,
  allCards,
  editingCardId,
  address,
  title,
  content,
  status,
  tagsText,
  relatedAddressesText,
  sourceType,
  sourceTitle,
  sourceAuthor,
  sourceUrl,
  sourcePage,
  sourceNote,
  aiSuggestion,
  aiSuggestionStatus,
  isSuggestingFiling,
  aiThinkingState,
  onAddressChange,
  onTitleChange,
  onContentChange,
  onStatusChange,
  onTagsChange,
  onRelatedAddressesChange,
  onSourceTypeChange,
  onSourceTitleChange,
  onSourceAuthorChange,
  onSourceUrlChange,
  onSourcePageChange,
  onSourceNoteChange,
  onSuggestFiling,
  onSuggestDifferentFiling,
  onApplySuggestedFiling,
  onApplySuggestedDetails,
  onApplyAllAiSuggestion,
  onSelectAlternativeFiling,
  onDismissAiSuggestion,
  onChooseCategory,
  onSave,
  onDelete,
  onCancel,
}: NewCardScreenProps) {
  const theme = getTheme(darkMode);
  const stepGlyph = {
    pending: '...',
    active: '...',
    done: 'OK',
  } as const;
  const statuses: Array<'Seed' | 'Growing' | 'Evergreen'> = ['Seed', 'Growing', 'Evergreen'];
  const sourceTypes: CardSourceType[] = ['Web', 'Book', 'Article', 'Video', 'Other'];
  const showSourceUrl = sourceType === 'Web' || sourceType === 'Article' || sourceType === 'Video';
  const showSourcePage = sourceType === 'Book' || sourceType === 'Article' || sourceType === 'Other';
  const sourceTitleLabel = sourceType === 'Book' ? 'Book Title' : sourceType === 'Web' ? 'Page / Site Title' : 'Source Title';
  const sourceAuthorLabel = sourceType === 'Book' ? 'Author' : 'Author / Creator';
  const sourcePageLabel = sourceType === 'Book' ? 'Page / Location' : 'Page, Section, or Location';
  const formatSuggestionLabel = (suggestion: CardFilingSuggestion | null) => {
    if (!suggestion) {
      return 'Manual review suggested';
    }

    if (suggestion.mode === 'new_category') {
      const rangePrefix = suggestion.suggestedNewCategoryRange || suggestion.suggestedParentRange;
      return [rangePrefix, suggestion.suggestedNewCategoryTitle].filter(Boolean).join(' - ');
    }

    if (suggestion.mode === 'existing_category') {
      return `${suggestion.suggestedCategoryRange} - ${suggestion.suggestedCategoryTitle}`;
    }

    return 'Manual review suggested';
  };
  const aiCategoryLabel = formatSuggestionLabel(aiSuggestion);
  const aiConfidenceLabel = aiSuggestion?.confidenceBand === 'high'
    ? 'High confidence'
    : aiSuggestion?.confidenceBand === 'medium'
      ? 'Medium confidence'
      : aiSuggestion?.confidenceBand === 'low'
        ? 'Low confidence'
        : '';
  const aiFilingButtonText = aiSuggestion?.mode === 'new_category' ? 'Create Category & Use Address' : 'Use Category & Address';
  const aiSuggestionStatusLabel = aiSuggestionStatus === 'local_preview'
    ? 'Local Preview'
    : aiSuggestionStatus === 'ai_confirmed'
      ? 'AI Confirmed'
      : aiSuggestionStatus === 'ai_revised'
        ? 'AI Revised'
        : aiSuggestionStatus === 'local_fallback'
          ? 'Local Fallback'
          : '';
  const aiSuggestionStatusNote = aiSuggestionStatus === 'local_preview'
    ? 'Shown instantly while AI checks the filing.'
    : aiSuggestionStatus === 'ai_confirmed'
      ? 'AI agreed with the initial filing preview.'
      : aiSuggestionStatus === 'ai_revised'
        ? 'AI refined the filing after a deeper pass.'
        : aiSuggestionStatus === 'local_fallback'
          ? 'AI was slow or unavailable, so the best local filing was kept.'
          : '';
  const relatedParts = relatedAddressesText.split(',');
  const relatedQuery = relatedParts[relatedParts.length - 1]?.trim().toLowerCase() ?? '';
  const selectedRelatedAddresses = parseCommaSeparatedValues(relatedAddressesText)
    .map(value => value.toLowerCase());
  const relatedSuggestions = relatedQuery.length === 0
    ? []
    : allCards
        .filter(card => card.id !== editingCardId)
        .filter(card => !selectedRelatedAddresses.includes(card.address.toLowerCase()))
        .filter(card => {
          const searchable = [
            card.address,
            card.title,
            card.content,
            card.source?.type,
            card.source?.title,
            card.source?.author,
            card.source?.url,
            card.source?.page,
            card.source?.note,
            ...(card.tags ?? []),
          ].join(' ').toLowerCase();

          return searchable.includes(relatedQuery);
        })
        .slice(0, 5);

  const addRelatedCard = (card: Card) => {
    const existingAddresses = parseCommaSeparatedValues(relatedAddressesText);
    const nextAddresses = [...existingAddresses, card.address]
      .filter((value, index, values) => values.indexOf(value) === index);
    onRelatedAddressesChange(nextAddresses.join(', '));
  };

  return (
    <View style={[styles.cardForm, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>{mode === 'edit' ? 'Edit Card' : 'New Antinet Card'}</Text>
      <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.secondaryBackground }]} onPress={onChooseCategory}>
        <Text style={[styles.categoryButtonText, { color: theme.secondaryButtonText }]}>
          {address ? `Card Address: ${address}` : 'Choose Category'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: theme.subtleText }]}>Card Address</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={address}
        onChangeText={onAddressChange}
        placeholder="e.g. 0102a"
        placeholderTextColor={theme.mutedText}
        autoCapitalize="none"
      />

      <Text style={[styles.label, { color: theme.subtleText }]}>Title (optional)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={title}
        onChangeText={onTitleChange}
        placeholder="Short summary"
        placeholderTextColor={theme.mutedText}
      />

      <Text style={[styles.label, { color: theme.subtleText }]}>Main Idea (One idea per card)</Text>
      <TextInput
        style={[styles.input, styles.contentInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={content}
        onChangeText={onContentChange}
        placeholder="Write your single main idea here..."
        placeholderTextColor={theme.mutedText}
        multiline
        numberOfLines={8}
      />

      <View style={[styles.aiAssistPanel, { backgroundColor: theme.tertiaryBackground, borderColor: theme.border }]}>
        <View style={styles.aiAssistHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.aiAssistTitle, { color: theme.text }]}>AI Cataloguing Assist</Text>
            <Text style={[styles.aiAssistBody, { color: theme.mutedText }]}>
              Draft first, then let Second Mind suggest where the card belongs.
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.aiAssistButton,
              { backgroundColor: theme.primaryButton, opacity: isSuggestingFiling ? 0.65 : 1 },
            ]}
            onPress={onSuggestFiling}
            disabled={isSuggestingFiling}
          >
            {isSuggestingFiling ? (
              <ThinkingDots style={[styles.aiAssistButtonText, { color: theme.primaryButtonText }]} />
            ) : (
              <Text style={[styles.aiAssistButtonText, { color: theme.primaryButtonText }]}>
                Suggest Filing
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {isSuggestingFiling && aiThinkingState?.kind === 'filing' && (
          <View style={[styles.aiThinkingCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <ThinkingDots prefix={aiThinkingState.title} style={[styles.aiThinkingTitle, { color: theme.text }]} />
            <Text style={[styles.aiThinkingBody, { color: theme.mutedText }]} numberOfLines={2}>
              {aiThinkingState.body}
            </Text>

            <View style={styles.aiThinkingStepList}>
              {aiThinkingState.steps.map(step => (
                <View
                  key={`${step.label}-${step.value ?? ''}`}
                  style={[styles.aiThinkingStepRow, { borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.aiThinkingStepLabel, { color: theme.text }]}>{step.label}</Text>
                    <Text style={[styles.aiThinkingStepValue, { color: theme.mutedText }]} numberOfLines={1}>
                      {step.value || (step.state === 'pending' ? 'Waiting' : 'Working')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.aiThinkingStepBadge,
                      {
                        backgroundColor:
                          step.state === 'done'
                            ? theme.primaryButton
                            : step.state === 'active'
                              ? theme.accentSoft
                              : theme.cardBackground,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.aiThinkingStepBadgeText,
                        { color: step.state === 'done' ? theme.primaryButtonText : theme.text },
                      ]}
                    >
                      {stepGlyph[step.state]}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {aiThinkingState.filingPreview && (
              <View style={styles.aiThinkingPathRow}>
                <View style={[styles.aiThinkingPathStop, { borderColor: theme.border, backgroundColor: theme.secondaryBackground }]}>
                  <Text style={[styles.aiThinkingPathLabel, { color: theme.subtleText }]}>Master</Text>
                  <Text style={[styles.aiThinkingPathValue, { color: theme.text }]} numberOfLines={1}>
                    {aiThinkingState.filingPreview.topMasterRange || 'Scanning'}
                  </Text>
                </View>
                <View style={[styles.aiThinkingPathStop, { borderColor: theme.border, backgroundColor: theme.secondaryBackground }]}>
                  <Text style={[styles.aiThinkingPathLabel, { color: theme.subtleText }]}>Category</Text>
                  <Text style={[styles.aiThinkingPathValue, { color: theme.text }]} numberOfLines={1}>
                    {aiThinkingState.filingPreview.selectedCategory || 'Choosing'}
                  </Text>
                </View>
                <View style={[styles.aiThinkingPathStop, { borderColor: theme.border, backgroundColor: theme.secondaryBackground }]}>
                  <Text style={[styles.aiThinkingPathLabel, { color: theme.subtleText }]}>Address</Text>
                  <Text style={[styles.aiThinkingPathValue, { color: theme.text }]} numberOfLines={1}>
                    {aiThinkingState.filingPreview.suggestedAddress || 'Next open'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {aiSuggestion && (
          <View style={[styles.aiSuggestionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Text style={[styles.aiSuggestionEyebrow, { color: theme.accent }]}>
              {aiSuggestion.mode === 'new_category' ? 'New Category Suggested' : aiSuggestion.mode === 'existing_category' ? 'Existing Category Suggested' : 'Review Suggested'}
            </Text>
            {aiSuggestionStatusLabel ? (
              <View style={styles.aiSuggestionMetaRow}>
                <View style={[styles.aiSuggestionStatusBadge, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}>
                  <Text style={[styles.aiSuggestionStatusText, { color: theme.secondaryButtonText }]}>
                    {aiSuggestionStatusLabel}
                  </Text>
                </View>
              </View>
            ) : null}
            <Text style={[styles.aiSuggestionTitle, { color: theme.text }]}>{aiCategoryLabel}</Text>
            {aiSuggestion.suggestedCardAddress && (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>Next card: {aiSuggestion.suggestedCardAddress}</Text>
            )}
            {aiSuggestion.suggestedTitle && (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>Title: {aiSuggestion.suggestedTitle}</Text>
            )}
            {aiSuggestion.suggestedContent && aiSuggestion.suggestedContent !== content && (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]} numberOfLines={3}>Cleaned idea: {aiSuggestion.suggestedContent}</Text>
            )}
            {aiSuggestion.suggestedSource && (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]} numberOfLines={2}>
                Source: {[aiSuggestion.suggestedSource.title, aiSuggestion.suggestedSource.author, aiSuggestion.suggestedSource.page].filter(Boolean).join(', ') || aiSuggestion.suggestedSource.type}
              </Text>
            )}
            {aiSuggestion.suggestedTags.length > 0 && (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>Tags: {aiSuggestion.suggestedTags.join(', ')}</Text>
            )}
            {aiSuggestion.suggestedRelatedAddresses.length > 0 && (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>Related: {aiSuggestion.suggestedRelatedAddresses.join(', ')}</Text>
            )}
            {aiConfidenceLabel ? (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>
                Confidence: {aiConfidenceLabel}
              </Text>
            ) : null}
            {aiSuggestionStatusNote ? (
              <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>
                Status: {aiSuggestionStatusNote}
              </Text>
            ) : null}
            <Text style={[styles.aiSuggestionReason, { color: theme.text }]}>{aiSuggestion.reasoning}</Text>
            {aiSuggestion.alternativeSuggestions && aiSuggestion.alternativeSuggestions.length > 0 && (
              <View style={styles.aiAlternativeBlock}>
                <Text style={[styles.aiSuggestionLine, { color: theme.mutedText }]}>Possible alternatives</Text>
                <View style={styles.aiAlternativeRow}>
                  {aiSuggestion.alternativeSuggestions.slice(0, 3).map((alternative, index) => (
                    <TouchableOpacity
                      key={`${alternative.mode}-${alternative.suggestedCategoryRange}-${alternative.suggestedParentRange}-${index}`}
                      style={[styles.aiAlternativeChip, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}
                      onPress={() => onSelectAlternativeFiling(index)}
                    >
                      <Text style={[styles.aiAlternativeChipText, { color: theme.secondaryButtonText }]} numberOfLines={2}>
                        {formatSuggestionLabel(alternative)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.aiActionRow}>
              {aiSuggestion.mode !== 'manual_review' && (
                <TouchableOpacity style={[styles.aiActionButton, { backgroundColor: theme.primaryButton }]} onPress={onApplyAllAiSuggestion}>
                  <Text style={[styles.aiActionButtonText, { color: theme.primaryButtonText }]}>Apply All</Text>
                </TouchableOpacity>
              )}
              {aiSuggestion.mode !== 'manual_review' && (
                <TouchableOpacity style={[styles.aiActionButton, { backgroundColor: theme.secondaryBackground }]} onPress={onApplySuggestedFiling}>
                  <Text style={[styles.aiActionButtonText, { color: theme.secondaryButtonText }]}>{aiFilingButtonText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.aiActionButton, { backgroundColor: theme.secondaryBackground }]} onPress={onApplySuggestedDetails}>
                <Text style={[styles.aiActionButtonText, { color: theme.secondaryButtonText }]}>Apply Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.aiActionButton, { backgroundColor: theme.secondaryBackground }]} onPress={onSuggestDifferentFiling}>
                <Text style={[styles.aiActionButtonText, { color: theme.secondaryButtonText }]}>Suggest Different</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.aiActionButton, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }]} onPress={onDismissAiSuggestion}>
                <Text style={[styles.aiActionButtonText, { color: theme.mutedText }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Text style={[styles.label, { color: theme.subtleText }]}>Status</Text>
      <View style={styles.segmentedRow}>
        {statuses.map(option => {
          const isActive = status === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.segmentedButton,
                {
                  backgroundColor: isActive ? theme.accentSoft : theme.cardBackground,
                  borderColor: isActive ? theme.accent : theme.border,
                },
              ]}
              onPress={() => onStatusChange(option)}
            >
              <Text style={[styles.segmentedButtonText, { color: isActive ? theme.accent : theme.text }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: theme.subtleText }]}>Tags</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={tagsText}
        onChangeText={onTagsChange}
        placeholder="e.g. philosophy, habits, identity"
        placeholderTextColor={theme.mutedText}
      />

      <View style={[styles.sourcePanel, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}>
        <Text style={[styles.sourcePanelTitle, { color: theme.secondaryButtonText }]}>Source / Reference</Text>
        <Text style={[styles.sourcePanelHelp, { color: theme.mutedText }]}>
          Optional, but useful for retracing where an idea came from.
        </Text>

        <Text style={[styles.label, { color: theme.subtleText }]}>Source Type</Text>
        <View style={styles.segmentedRow}>
          {sourceTypes.map(option => {
            const isActive = sourceType === option;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.segmentedButton,
                  {
                    backgroundColor: isActive ? theme.accentSoft : theme.cardBackground,
                    borderColor: isActive ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => onSourceTypeChange(option)}
              >
                <Text style={[styles.segmentedButtonText, { color: isActive ? theme.accent : theme.text }]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.subtleText }]}>{sourceTitleLabel}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={sourceTitle}
          onChangeText={onSourceTitleChange}
          placeholder={sourceType === 'Book' ? 'e.g. How to Take Smart Notes' : 'e.g. Article, website, video, or source name'}
          placeholderTextColor={theme.mutedText}
        />

        <Text style={[styles.label, { color: theme.subtleText }]}>{sourceAuthorLabel}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={sourceAuthor}
          onChangeText={onSourceAuthorChange}
          placeholder="Name, publication, channel, or organization"
          placeholderTextColor={theme.mutedText}
        />

        {showSourceUrl && (
          <>
            <Text style={[styles.label, { color: theme.subtleText }]}>URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
              value={sourceUrl}
              onChangeText={onSourceUrlChange}
              placeholder="https://..."
              placeholderTextColor={theme.mutedText}
              autoCapitalize="none"
              keyboardType="url"
            />
          </>
        )}

        {showSourcePage && (
          <>
            <Text style={[styles.label, { color: theme.subtleText }]}>{sourcePageLabel}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
              value={sourcePage}
              onChangeText={onSourcePageChange}
              placeholder="e.g. p. 42, Chapter 3, timestamp 12:08"
              placeholderTextColor={theme.mutedText}
            />
          </>
        )}

        <Text style={[styles.label, { color: theme.subtleText }]}>Source Note</Text>
        <TextInput
          style={[styles.input, styles.sourceNoteInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
          value={sourceNote}
          onChangeText={onSourceNoteChange}
          placeholder="Why this source matters, quote context, edition, etc."
          placeholderTextColor={theme.mutedText}
          multiline
          numberOfLines={3}
        />
      </View>

      <Text style={[styles.label, { color: theme.subtleText }]}>Related Card Addresses</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={relatedAddressesText}
        onChangeText={onRelatedAddressesChange}
        placeholder="Search title, tag, or address..."
        placeholderTextColor={theme.mutedText}
        autoCapitalize="none"
      />

      {relatedSuggestions.length > 0 && (
        <View style={[styles.suggestionPanel, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          {relatedSuggestions.map(card => (
            <TouchableOpacity
              key={card.id}
              style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
              onPress={() => addRelatedCard(card)}
            >
              <Text style={[styles.suggestionTitle, { color: theme.text }]}>{card.title}</Text>
              <Text style={[styles.suggestionMeta, { color: theme.mutedText }]}>{card.address}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={onSave}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>{mode === 'edit' ? 'Save Changes' : 'Save Card'}</Text>
      </TouchableOpacity>

      {mode === 'edit' && onDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete Card</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
