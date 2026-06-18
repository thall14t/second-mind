import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { AskCardsResult, Card } from '../types';

interface AskCardsScreenProps {
  darkMode: boolean;
  question: string;
  result: AskCardsResult | null;
  isAsking: boolean;
  cards: Card[];
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onSelectCard: (card: Card) => void;
  onBack: () => void;
}

export default function AskCardsScreen({
  darkMode,
  question,
  result,
  isAsking,
  cards,
  onQuestionChange,
  onAsk,
  onSelectCard,
  onBack,
}: AskCardsScreenProps) {
  const theme = getTheme(darkMode);
  const referencedCards = (result?.referencedAddresses ?? [])
    .map(address => cards.find(card => card.address.toLowerCase() === address.toLowerCase()))
    .filter((card): card is Card => Boolean(card));

  return (
    <View style={[styles.cardForm, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Ask My Cards</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Ask a question and Second Mind will answer from your saved cards.
      </Text>

      <Text style={[styles.label, { color: theme.subtleText }]}>Question</Text>
      <TextInput
        style={[styles.input, styles.askCardsInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
        value={question}
        onChangeText={onQuestionChange}
        placeholder="e.g. What have I written about attention?"
        placeholderTextColor={theme.mutedText}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: theme.primaryButton, opacity: isAsking ? 0.65 : 1 }]}
        onPress={onAsk}
        disabled={isAsking}
      >
        <Text style={[styles.saveButtonText, { color: theme.primaryButtonText }]}>
          {isAsking ? 'Searching Your Cards...' : 'Ask My Cards'}
        </Text>
      </TouchableOpacity>

      {result && (
        <View style={[styles.askAnswerPanel, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.askAnswerEyebrow, { color: theme.accent }]}>Answer</Text>
          <Text style={[styles.askAnswerText, { color: theme.text }]}>{result.answer}</Text>

          {referencedCards.length > 0 && (
            <View style={styles.askSection}>
              <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>Referenced Cards</Text>
              {referencedCards.map(card => (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.relatedCardButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => onSelectCard(card)}
                >
                  <Text style={[styles.relatedCardTitle, { color: theme.text }]}>{card.title}</Text>
                  <Text style={[styles.relatedCardMeta, { color: theme.mutedText }]}>{card.address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {result.suggestedFollowUps.length > 0 && (
            <View style={styles.askSection}>
              <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>Follow-Up Questions</Text>
              {result.suggestedFollowUps.map(followUp => (
                <TouchableOpacity
                  key={followUp}
                  style={[styles.followUpButton, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}
                  onPress={() => onQuestionChange(followUp)}
                >
                  <Text style={[styles.followUpText, { color: theme.secondaryButtonText }]}>{followUp}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
