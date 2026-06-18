import React, { useMemo } from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { APP_NAME } from '../branding';
import { styles } from '../styles';
import { getCardTone, getTheme } from '../theme';
import { Card, ManagedCategory } from '../types';
import { getCardToneKey, getCategoryForCard } from '../utils/antinet';

interface CardThreadViewProps {
  card: Card;
  cards: Card[];
  categories: ManagedCategory[];
  darkMode: boolean;
  onSelectCard: (card: Card) => void;
  onOpenDetails: () => void;
  onClose: () => void;
}

interface ThreadNode {
  card: Card;
  degree: 0 | 1 | 2;
  angle: number;
  x: number;
  y: number;
  categoryLabel: string;
}

const MAX_DIRECT_NODES = 8;
const MAX_SECONDARY_NODES = 10;

const normalizeAddress = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const buildConnectionStyle = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string
) => {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  return {
    position: 'absolute' as const,
    left: startX + dx / 2 - length / 2,
    top: startY + dy / 2 - 1,
    width: length,
    height: 2,
    borderRadius: 999,
    backgroundColor: color,
    opacity: 0.6,
    transform: [{ rotate: `${angle}rad` }],
  };
};

export default function CardThreadView({
  card,
  cards,
  categories,
  darkMode,
  onSelectCard,
  onOpenDetails,
  onClose,
}: CardThreadViewProps) {
  const theme = getTheme(darkMode);
  const centerTone = getCardTone(getCardToneKey(card.address), darkMode);
  const screenWidth = Dimensions.get('window').width;
  const canvasSize = Math.max(320, Math.min(screenWidth - 24, 420));
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const directRadius = canvasSize * 0.27;
  const secondaryRadius = canvasSize * 0.41;
  const nodeSize = Math.max(78, Math.min(104, canvasSize * 0.24));
  const secondaryNodeSize = Math.max(66, Math.min(88, canvasSize * 0.2));

  const threadData = useMemo(() => {
    const addressMap = new Map(cards.map(candidate => [normalizeAddress(candidate.address), candidate]));
    const centerAddress = normalizeAddress(card.address);
    const directCards = (card.relatedAddresses ?? [])
      .map(address => addressMap.get(normalizeAddress(address)))
      .filter((candidate): candidate is Card => Boolean(candidate))
      .slice(0, MAX_DIRECT_NODES);

    const directAddressSet = new Set(directCards.map(candidate => normalizeAddress(candidate.address)));
    const secondDegreeMap = new Map<string, Card>();

    directCards.forEach(relatedCard => {
      (relatedCard.relatedAddresses ?? []).forEach(address => {
        const normalized = normalizeAddress(address);
        if (!normalized || normalized === centerAddress || directAddressSet.has(normalized)) {
          return;
        }

        const candidate = addressMap.get(normalized);
        if (candidate) {
          secondDegreeMap.set(normalized, candidate);
        }
      });
    });

    const secondDegreeCards = Array.from(secondDegreeMap.values()).slice(0, MAX_SECONDARY_NODES);
    const hiddenSecondDegreeCount = Math.max(0, secondDegreeMap.size - secondDegreeCards.length);

    const toNode = (candidate: Card, degree: 0 | 1 | 2, angle: number, radius: number) => {
      const category = getCategoryForCard(candidate.address, categories);
      return {
        card: candidate,
        degree,
        angle,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        categoryLabel: category?.title || category?.range || candidate.address,
      } satisfies ThreadNode;
    };

    const directNodes = directCards.map((candidate, index) => {
      const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / Math.max(directCards.length, 1);
      return toNode(candidate, 1, angle, directRadius);
    });

    const secondDegreeNodes = secondDegreeCards.map((candidate, index) => {
      const angle = (-Math.PI / 2) + Math.PI / 6 + (index * (Math.PI * 2)) / Math.max(secondDegreeCards.length, 1);
      return toNode(candidate, 2, angle, secondaryRadius);
    });

    const centerCategory = getCategoryForCard(card.address, categories);

    return {
      centerCategoryLabel: centerCategory?.title || centerCategory?.range || card.address,
      directNodes,
      secondDegreeNodes,
      hiddenSecondDegreeCount,
    };
  }, [card, cards, categories, centerX, centerY, directRadius, secondaryRadius]);

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
            borderTopColor: centerTone.accent,
            shadowColor: darkMode ? '#000' : theme.shadow,
            shadowOpacity: darkMode ? 0.18 : 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          },
        ]}
      >
        <View style={styles.cardViewerBrandRow}>
          <Text style={[styles.cardViewerBrandText, { color: centerTone.accent }]}>{APP_NAME} Thread View</Text>
        </View>

        <View style={styles.cardViewerHeader}>
          <View style={styles.cardViewerMetaRow}>
            <View style={styles.cardViewerMetaGroup}>
              <Text style={[styles.cardAddress, { color: centerTone.accent }]}>{card.address}</Text>
              <Text style={[styles.cardCategory, { color: theme.mutedText }]}>{threadData.centerCategoryLabel}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <View style={[styles.statusChip, { backgroundColor: centerTone.wash }]}>
                <Text style={[styles.statusChipText, { color: centerTone.accent }]}>
                  {threadData.directNodes.length} direct
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: theme.secondaryBackground }]}>
                <Text style={[styles.statusChipText, { color: theme.secondaryButtonText }]}>
                  {threadData.secondDegreeNodes.length} nearby
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.cardViewerTitle, { color: theme.text }]}>{card.title}</Text>
          <Text style={[styles.threadIntroText, { color: theme.mutedText }]}>
            A focused map of this note, its direct links, and nearby second-degree cards. Tap any node to recenter the thread.
          </Text>
        </View>

        <View style={[styles.threadGraphCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View
            style={[
              styles.threadGraphCanvas,
              { width: canvasSize, height: canvasSize, backgroundColor: theme.cardBackground, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.threadRing,
                {
                  width: directRadius * 2,
                  height: directRadius * 2,
                  left: centerX - directRadius,
                  top: centerY - directRadius,
                  borderColor: theme.border,
                },
              ]}
            />
            <View
              style={[
                styles.threadRing,
                {
                  width: secondaryRadius * 2,
                  height: secondaryRadius * 2,
                  left: centerX - secondaryRadius,
                  top: centerY - secondaryRadius,
                  borderColor: theme.border,
                },
              ]}
            />

            {threadData.directNodes.map(node => (
              <View
                key={`line-${node.card.id}`}
                style={buildConnectionStyle(centerX, centerY, node.x, node.y, centerTone.accent)}
              />
            ))}

            {threadData.secondDegreeNodes.map(node => {
              const anchorNode = threadData.directNodes.reduce<ThreadNode | null>((bestNode, candidate) => {
                const candidateDistance = Math.abs(candidate.angle - node.angle);
                if (!bestNode) {
                  return candidate;
                }

                return candidateDistance < Math.abs(bestNode.angle - node.angle) ? candidate : bestNode;
              }, null);

              return anchorNode ? (
                <View
                  key={`branch-${node.card.id}`}
                  style={buildConnectionStyle(anchorNode.x, anchorNode.y, node.x, node.y, theme.mutedText)}
                />
              ) : null;
            })}

            {threadData.secondDegreeNodes.map(node => {
              const tone = getCardTone(getCardToneKey(node.card.address), darkMode);

              return (
                <TouchableOpacity
                  key={node.card.id}
                  style={[
                    styles.threadNode,
                    styles.threadNodeSecondary,
                    {
                      width: secondaryNodeSize,
                      minHeight: secondaryNodeSize,
                      left: node.x - secondaryNodeSize / 2,
                      top: node.y - secondaryNodeSize / 2,
                      backgroundColor: tone.wash,
                      borderColor: tone.accent,
                    },
                  ]}
                  onPress={() => onSelectCard(node.card)}
                >
                  <Text style={[styles.threadNodeAddress, { color: tone.accent }]} numberOfLines={1}>
                    {node.card.address}
                  </Text>
                  <Text style={[styles.threadNodeTitle, { color: theme.text }]} numberOfLines={2}>
                    {node.card.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {threadData.directNodes.map(node => {
              const tone = getCardTone(getCardToneKey(node.card.address), darkMode);

              return (
                <TouchableOpacity
                  key={node.card.id}
                  style={[
                    styles.threadNode,
                    {
                      width: nodeSize,
                      minHeight: nodeSize,
                      left: node.x - nodeSize / 2,
                      top: node.y - nodeSize / 2,
                      backgroundColor: tone.wash,
                      borderColor: tone.accent,
                    },
                  ]}
                  onPress={() => onSelectCard(node.card)}
                >
                  <Text style={[styles.threadNodeAddress, { color: tone.accent }]} numberOfLines={1}>
                    {node.card.address}
                  </Text>
                  <Text style={[styles.threadNodeTitle, { color: theme.text }]} numberOfLines={2}>
                    {node.card.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View
              style={[
                styles.threadNode,
                styles.threadNodeCenter,
                {
                  width: nodeSize + 22,
                  minHeight: nodeSize + 22,
                  left: centerX - (nodeSize + 22) / 2,
                  top: centerY - (nodeSize + 22) / 2,
                  backgroundColor: theme.tertiaryBackground,
                  borderColor: centerTone.accent,
                },
              ]}
            >
              <Text style={[styles.threadNodeAddress, { color: centerTone.accent }]} numberOfLines={1}>
                {card.address}
              </Text>
              <Text style={[styles.threadNodeTitle, { color: theme.text }]} numberOfLines={3}>
                {card.title}
              </Text>
            </View>
          </View>

          <View style={styles.threadLegendRow}>
            <View style={[styles.threadLegendChip, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.threadLegendLabel, { color: theme.text }]}>Center: current card</Text>
            </View>
            <View style={[styles.threadLegendChip, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.threadLegendLabel, { color: theme.text }]}>Inner ring: direct links</Text>
            </View>
            <View style={[styles.threadLegendChip, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.threadLegendLabel, { color: theme.text }]}>Outer ring: nearby cards</Text>
            </View>
          </View>

          {threadData.hiddenSecondDegreeCount > 0 && (
            <Text style={[styles.threadOverflowNote, { color: theme.mutedText }]}>
              +{threadData.hiddenSecondDegreeCount} additional nearby cards hidden to keep the view readable.
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primaryButton }]} onPress={onOpenDetails}>
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>Back To Card</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.cancelButton, { marginTop: 12 }]} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
