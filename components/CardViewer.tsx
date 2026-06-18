import React from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { APP_NAME } from '../branding';
import { Card, ManagedCategory } from '../types';
import { styles } from '../styles';
import { getCardTone, getTheme } from '../theme';
import { formatCardDate, getCardToneKey, getCategoryForCard, getTopLevelRangeForAddress } from '../utils/antinet';

interface CardViewerProps {
  card: Card;
  darkMode: boolean;
  cards: Card[];
  categories: ManagedCategory[];
  onSelectRelatedCard: (card: Card) => void;
  onOpenThread: (card: Card) => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  onClose: () => void;
}

export default function CardViewer({
  card,
  darkMode,
  cards,
  categories,
  onSelectRelatedCard,
  onOpenThread,
  onEdit,
  onDelete,
  onClose,
}: CardViewerProps) {
  const theme = getTheme(darkMode);
  const tone = getCardTone(getCardToneKey(card.address), darkMode);
  const category = getCategoryForCard(card.address, categories);
  const topLevelRange = getTopLevelRangeForAddress(card.address, categories);
  const relatedCards = (card.relatedAddresses ?? [])
    .map(address => cards.find(candidate => candidate.address.toLowerCase() === address.toLowerCase()))
    .filter((candidate): candidate is Card => Boolean(candidate));
  const source = card.source;
  const hasSource = Boolean(source?.title || source?.author || source?.url || source?.page || source?.note);
  const openSourceUrl = () => {
    if (!source?.url) {
      return;
    }

    const targetUrl = /^https?:\/\//i.test(source.url) ? source.url : `https://${source.url}`;
    Linking.openURL(targetUrl).catch(() => undefined);
  };

  return (
    <ScrollView
      style={[styles.cardViewerScroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.cardViewer}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.cardViewerShell,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            borderTopColor: tone.accent,
            shadowColor: darkMode ? '#000' : theme.shadow,
            shadowOpacity: darkMode ? 0.18 : 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          },
        ]}
      >
        <Image
          source={require('../assets/second-mind-logo.jpg')}
          style={styles.cardViewerWatermark}
          resizeMode="cover"
          fadeDuration={0}
        />
        <View style={styles.cardViewerBrandRow}>
          <Image
            source={require('../assets/second-mind-logo.jpg')}
            style={[styles.cardViewerLogo, { borderWidth: 1, borderColor: theme.border }]}
            resizeMode="cover"
            fadeDuration={0}
          />
          <Text style={[styles.cardViewerBrandText, { color: tone.accent }]}>{APP_NAME}</Text>
        </View>

        <View style={styles.cardViewerHeader}>
          <View style={styles.cardViewerMetaRow}>
            <View style={styles.cardViewerMetaGroup}>
              <Text style={[styles.cardAddress, { color: tone.accent }]}>{card.address}</Text>
              {category && <Text style={[styles.cardCategory, { color: theme.mutedText }]}>{category.title || category.range}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <View style={[styles.statusChip, { backgroundColor: tone.wash }]}>
                <Text style={[styles.statusChipText, { color: tone.accent }]}>{card.status ?? 'Seed'}</Text>
              </View>
              <Text style={[styles.cardDate, { color: theme.mutedText }]}>{formatCardDate(card.createdAt)}</Text>
            </View>
          </View>

          <Text style={[styles.cardViewerTitle, { color: theme.text }]}>{card.title}</Text>
          <View style={[styles.cardViewerRule, { backgroundColor: theme.border }]} />
          {topLevelRange && (
            <View style={styles.cardFooterRow}>
              <View style={[styles.chip, { backgroundColor: theme.tertiaryBackground, borderColor: theme.border }]}>
                <Text style={[styles.chipText, { color: theme.secondaryButtonText }]}>{topLevelRange.title || topLevelRange.range}</Text>
              </View>
              {(card.tags ?? []).map(tag => (
                <View key={tag} style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }]}>
                  <Text style={[styles.chipText, { color: theme.secondaryButtonText }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.cardViewerSection}>
          <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>Main Idea</Text>
          <Text style={[styles.cardViewerContent, { color: theme.text }]}>{card.content}</Text>
        </View>

        {hasSource && source && (
          <View style={styles.cardViewerSection}>
            <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>Source</Text>
            <View style={[styles.sourceViewerPanel, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.sourceViewerType, { color: tone.accent }]}>{source.type}</Text>
              {source.title && <Text style={[styles.sourceViewerTitle, { color: theme.text }]}>{source.title}</Text>}
              {source.author && <Text style={[styles.sourceViewerDetail, { color: theme.mutedText }]}>By {source.author}</Text>}
              {source.page && <Text style={[styles.sourceViewerDetail, { color: theme.mutedText }]}>Location: {source.page}</Text>}
              {source.url && (
                <TouchableOpacity style={[styles.sourceUrlButton, { borderColor: theme.border }]} onPress={openSourceUrl}>
                  <Text style={[styles.sourceUrlText, { color: tone.accent }]} numberOfLines={1}>{source.url}</Text>
                </TouchableOpacity>
              )}
              {source.note && <Text style={[styles.sourceViewerNote, { color: theme.text }]}>{source.note}</Text>}
            </View>
          </View>
        )}

        {relatedCards.length > 0 && (
          <View style={styles.cardViewerSection}>
            <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>Related Cards</Text>
            {relatedCards.map(relatedCard => (
              <TouchableOpacity
                key={relatedCard.id}
                style={[styles.relatedCardButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => onSelectRelatedCard(relatedCard)}
              >
                <Text style={[styles.relatedCardTitle, { color: theme.text }]}>{relatedCard.title}</Text>
                <Text style={[styles.relatedCardMeta, { color: theme.mutedText }]}>{relatedCard.address}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.cardViewerSection}>
          <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>Thread View</Text>
          <TouchableOpacity
            style={[styles.relatedCardButton, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => onOpenThread(card)}
          >
            <Text style={[styles.relatedCardTitle, { color: theme.text }]}>Open Connected Thread</Text>
            <Text style={[styles.relatedCardMeta, { color: theme.mutedText }]}>
              See this card, its direct links, and nearby connected ideas in one visual map.
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={() => onEdit(card)}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>Edit Card</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(card)}>
        <Text style={styles.deleteButtonText}>Delete Card</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
