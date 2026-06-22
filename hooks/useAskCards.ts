import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { antinetCategories } from '../data/antinetCategories';
import { AskCardsResult } from '../types';
import { buildCategoryTree, flattenCategories } from '../utils/antinet';
import { useDataStore } from '../utils/stores/dataStore';
import {
  AI_CARD_CONTENT_MAX_CHARS,
  ASK_CARDS_TIMEOUT_MS,
  DEFAULT_AI_ASSIST_ENDPOINT,
} from '../constants';

export function useAskCards() {
  const {
    cards,
    customCategories,
    categoryOverrides,
    deletedDefaultCategoryIds,
    settings,
    askCardsQuestion,
    askCardsResult,
    isAskingCards,
    setAskCardsQuestion,
    setAskCardsResult,
    setIsAskingCards,
  } = useDataStore();

  const allCategories = useMemo(() => {
    const tree = buildCategoryTree(antinetCategories, customCategories, categoryOverrides, deletedDefaultCategoryIds);
    return flattenCategories(tree);
  }, [customCategories, categoryOverrides, deletedDefaultCategoryIds]);

  const getEndpoint = useCallback(() => {
    const base = settings.aiAssistEndpoint?.trim() || DEFAULT_AI_ASSIST_ENDPOINT;
    return `${base.replace(/\/+$/, '')}/api/ask-cards`;
  }, [settings.aiAssistEndpoint]);

  const ask = useCallback(async () => {
    if (!askCardsQuestion.trim()) {
      Alert.alert('Ask A Question First', 'Type a question for your cards before asking Second Mind.');
      return;
    }
    if (cards.length === 0) {
      Alert.alert('No Cards Yet', 'Add cards to your library before using Ask My Cards.');
      return;
    }

    setIsAskingCards(true);
    try {
      const payload = {
        question: askCardsQuestion.trim(),
        cards: cards.map(card => ({
          address: card.address,
          title: card.title,
          content: card.content.slice(0, AI_CARD_CONTENT_MAX_CHARS),
          status: card.status,
          tags: card.tags,
          relatedAddresses: card.relatedAddresses,
          source: card.source,
        })),
        categories: allCategories.map(cat => ({ range: cat.range, title: cat.title })),
      };

      const response = await fetch(getEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ASK_CARDS_TIMEOUT_MS),
      });
      const data = await response.json() as { result?: AskCardsResult; error?: string };

      if (!response.ok || !data.result) {
        throw new Error(data.error || 'The AI assistant did not return an answer.');
      }
      setAskCardsResult(data.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The AI assistant could not be reached.';
      Alert.alert(
        'Ask My Cards Unavailable',
        `${message}\n\nMake sure the AI server is running and the Settings URL is correct.`
      );
    } finally {
      setIsAskingCards(false);
    }
  }, [askCardsQuestion, cards, allCategories, getEndpoint, setIsAskingCards, setAskCardsResult]);

  return {
    question: askCardsQuestion,
    result: askCardsResult as AskCardsResult | null,
    isAsking: isAskingCards,
    setQuestion: setAskCardsQuestion,
    ask,
  };
}
