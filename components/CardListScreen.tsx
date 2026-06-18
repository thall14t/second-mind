import React, { useEffect, useRef } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, CardSortMode, ManagedCategory } from '../types';
import { styles } from '../styles';
import { getCardTone, getTheme } from '../theme';
import { cardBelongsToCategory, formatCardDate, getCardToneKey, getCategoryForCard } from '../utils/antinet';

interface CardListScreenProps {
  darkMode: boolean;
  cards: Card[];
  allCards: Card[];
  categories: ManagedCategory[];
  masterRanges: ManagedCategory[];
  selectedMasterRange: ManagedCategory | null;
  searchQuery: string;
  sortMode: CardSortMode;
  restoreCardAddress: string | null;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: CardSortMode) => void;
  onSelectMasterRange: (range: ManagedCategory) => void;
  onClearMasterRange: () => void;
  onScrollRestored: () => void;
  onSelectCard: (card: Card) => void;
  onManageCard: (card: Card) => void;
  onBack: () => void;
}

export default function CardListScreen({
  darkMode,
  cards,
  allCards,
  categories,
  masterRanges,
  selectedMasterRange,
  searchQuery,
  sortMode,
  restoreCardAddress,
  onSearchChange,
  onSortModeChange,
  onSelectMasterRange,
  onClearMasterRange,
  onScrollRestored,
  onSelectCard,
  onManageCard,
  onBack,
}: CardListScreenProps) {
  const theme = getTheme(darkMode);
  const listRef = useRef<FlatList<Card>>(null);
  const hasRestoredScrollRef = useRef(false);
  const restoreIndex = restoreCardAddress
    ? cards.findIndex(card => card.address.toLowerCase() === restoreCardAddress.toLowerCase())
    : -1;
  const estimatedCardHeight = 330;

  useEffect(() => {
    hasRestoredScrollRef.current = false;
  }, [restoreCardAddress]);

  const restoreScrollPosition = () => {
    if (hasRestoredScrollRef.current || restoreIndex < 0) {
      return;
    }

    hasRestoredScrollRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: restoreIndex, animated: false, viewPosition: 0.18 });
      onScrollRestored();
    });
  };

  const renderCardItem = ({ item }: { item: Card }) => {
    const category = getCategoryForCard(item.address, categories);
    const tone = getCardTone(getCardToneKey(item.address), darkMode);
    const relatedCount = item.relatedAddresses?.filter(address =>
      allCards.some(card => card.address.toLowerCase() === address.toLowerCase())
    ).length ?? 0;
    const categoryLabel = category?.title || category?.range || 'Unfiled';
    const previewText = item.content.trim() || 'Open this notecard to add more notes and connections.';
    const visibleTags = item.tags?.slice(0, 2) ?? [];
    const sourceLabel = item.source?.title || item.source?.url || item.source?.author;
    return (
      <View style={styles.cardStackWrap}>
        <View style={[styles.cardStackBackplate, { backgroundColor: tone.wash, borderColor: theme.border }]} />
        <TouchableOpacity
          style={[
            styles.cardListItem,
            styles.cardStackShadow,
            {
              backgroundColor: theme.cardBackground,
              borderTopColor: darkMode ? theme.border : '#d8c29f',
              borderColor: theme.border,
              shadowColor: darkMode ? '#000' : theme.shadow,
              shadowOpacity: darkMode ? 0.22 : 0.16,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
            },
          ]}
          onPress={() => onSelectCard(item)}
          onLongPress={() => onManageCard(item)}
        >
          <View style={[styles.cardWearTop, { backgroundColor: tone.wash }]} />
          <View style={[styles.cardWearCornerLeft, { borderColor: darkMode ? '#3b2b23' : '#dfcaa8' }]} />
          <View style={[styles.cardWearCornerRight, { borderColor: darkMode ? '#3b2b23' : '#dfcaa8' }]} />
          <View style={[styles.cardCornerPin, { backgroundColor: tone.accent }]} />
          <View style={styles.cardMetaRow}>
            <View style={styles.cardMetaLeft}>
              <Text style={[styles.cardAddress, { color: tone.accent }]}>{item.address}</Text>
            </View>
            <View style={styles.cardMetaRight}>
              <Text style={[styles.cardDate, { color: theme.mutedText }]}>{item.status ?? 'Seed'}</Text>
            </View>
          </View>

          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.drawerCardCategory, { color: theme.mutedText }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
          <View style={[styles.cardRule, { backgroundColor: theme.border }]} />
          <View style={styles.noteLines}>
            <View style={[styles.noteLine, { backgroundColor: darkMode ? '#3a2d27' : '#eadcc7' }]} />
            <View style={[styles.noteLine, { backgroundColor: darkMode ? '#3a2d27' : '#eadcc7' }]} />
            <View style={[styles.noteLine, { backgroundColor: darkMode ? '#3a2d27' : '#eadcc7' }]} />
          </View>
          <Text style={[styles.cardPreview, { color: theme.text }]} numberOfLines={3}>
            {previewText}
          </Text>
          <View style={styles.drawerCardFooter}>
            <Text style={[styles.drawerCardFooterText, { color: theme.mutedText, borderColor: theme.border }]}>
              {formatCardDate(item.createdAt)}
            </Text>
            <Text style={[styles.drawerCardFooterText, { color: theme.mutedText, borderColor: theme.border }]}>
              {relatedCount > 0 ? `${relatedCount} linked` : 'No links yet'}
            </Text>
            {sourceLabel && (
              <Text style={[styles.drawerCardFooterText, { color: tone.accent, borderColor: theme.border }]} numberOfLines={1}>
                {item.source?.type}: {sourceLabel}
              </Text>
            )}
            {visibleTags.map(tag => (
              <Text key={tag} style={[styles.drawerCardFooterText, { color: tone.accent, borderColor: theme.border }]} numberOfLines={1}>
                #{tag}
              </Text>
            ))}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>My Cards</Text>
      {!selectedMasterRange ? (
        <ScrollView
          style={styles.masterBoxScroll}
          contentContainerStyle={styles.masterBoxScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.contextText, { color: theme.mutedText }]}>
            Choose a master file box to narrow the stack before browsing.
          </Text>
          <View style={styles.masterBoxGrid}>
            {masterRanges.map(range => {
              const cardCount = allCards.filter(card => cardBelongsToCategory(card, range)).length;
              return (
                <TouchableOpacity
                  key={range.id}
                  style={[
                    styles.masterBox,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                      shadowColor: darkMode ? '#000' : theme.shadow,
                    },
                  ]}
                  onPress={() => onSelectMasterRange(range)}
                >
                  <View style={[styles.masterBoxIcon, { backgroundColor: darkMode ? '#4a2f1d' : '#9f6b34' }]}>
                    <View style={[styles.masterBoxCardBack, { backgroundColor: darkMode ? '#f0dfc4' : '#fffaf2' }]} />
                    <View style={[styles.masterBoxCardFront, { backgroundColor: darkMode ? '#d9c6a7' : '#f7ecd7' }]} />
                  </View>
                  <Text style={[styles.masterBoxRange, { color: theme.text }]}>{range.range}</Text>
                  <Text style={[styles.masterBoxTitle, { color: theme.mutedText }]} numberOfLines={2}>
                    {range.title || 'Unlabeled Range'}
                  </Text>
                  <Text style={[styles.masterBoxCount, { color: theme.secondaryButtonText, backgroundColor: theme.accentSoft }]}>
                    {cardCount} cards
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
            <Text style={styles.cancelButtonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.secondaryBackground }]} onPress={onClearMasterRange}>
            <Text style={[styles.categoryButtonText, { color: theme.secondaryButtonText }]}>
              {selectedMasterRange.range} {selectedMasterRange.title ? `- ${selectedMasterRange.title}` : ''} | Change File Box
            </Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Search by address, title, content, or tags..."
            placeholderTextColor={theme.mutedText}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          <View style={styles.cardSortRow}>
            {([
              ['address', 'Numerical Order'],
              ['recent', 'Most Recent'],
            ] as Array<[CardSortMode, string]>).map(([mode, label]) => {
              const isActive = sortMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.cardSortButton,
                    {
                      backgroundColor: isActive ? theme.primaryButton : theme.secondaryBackground,
                      borderColor: isActive ? theme.primaryButton : theme.border,
                    },
                  ]}
                  onPress={() => onSortModeChange(mode)}
                >
                  <Text style={[styles.cardSortButtonText, { color: isActive ? theme.primaryButtonText : theme.secondaryButtonText }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {cards.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>{searchQuery ? 'No matching cards found' : 'No cards yet'}</Text>
          ) : (
            <View style={[styles.drawerScene, { backgroundColor: darkMode ? '#2a1d16' : '#b98245' }]}>
              <View style={[styles.drawerTopRail, { backgroundColor: darkMode ? '#1c120e' : '#8e5c2b' }]} />
              <View style={[styles.drawerInnerWell, { backgroundColor: darkMode ? '#19110e' : '#8b5a2b' }]}>
                <FlatList
                  ref={listRef}
                  data={cards}
                  keyExtractor={(item) => item.id}
                  renderItem={renderCardItem}
                  contentContainerStyle={styles.drawerCardsContent}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={restoreScrollPosition}
                  onLayout={restoreScrollPosition}
                  getItemLayout={(_, index) => ({
                    length: estimatedCardHeight,
                    offset: estimatedCardHeight * index,
                    index,
                  })}
                  onScrollToIndexFailed={(info) => {
                    listRef.current?.scrollToOffset({
                      offset: Math.max(0, info.averageItemLength * info.index),
                      animated: false,
                    });
                    requestAnimationFrame(() => {
                      listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.18 });
                      onScrollRestored();
                    });
                  }}
                />
              </View>
              <View style={[styles.drawerFrontRail, { backgroundColor: darkMode ? '#3a281d' : '#9f6b34' }]} />
            </View>
          )}
          <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
            <Text style={styles.cancelButtonText}>Back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
