import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  AiAssistPayload,
  Card,
  CardFilingSuggestion,
  FilingSuggestionStatus,
  ManagedCategory,
  ThinkingState,
} from '../types';
import { buildFilingPlanV2 } from '../utils/aiCataloguing';
import { buildAiRequestCacheKey, fetchJsonWithTimeout } from '../utils/aiRequests';
import {
  applyFilingThinkingResult,
  buildAiAssistPayload,
  buildTimedOutLocalFilingFallbackSuggestion,
  createFilingThinkingState,
  ensureManualReviewFilingWhy,
  finalizeFilingSuggestion,
  normalizeHierarchicalSuggestion,
} from '../utils/aiFiling';

const AI_RESPONSE_CACHE_LIMIT = 40;

interface UseAiFilingParams {
  allCategories: ManagedCategory[];
  categoryTree: ManagedCategory[];
  cards: Card[];
  editingCardId?: string | null;
  getEndpoint: () => string;
  getCurrentDraft: (draftOverride?: AiAssistPayload['draft']) => AiAssistPayload['draft'];
  setThinkingState: React.Dispatch<React.SetStateAction<ThinkingState | null>>;
  clearAiProgress?: () => void;
  timeoutMs: number;
}

const rememberCachedAiValue = <T,>(cache: Map<string, T>, key: string, value: T) => {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);
  if (cache.size > AI_RESPONSE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
};

const areFilingTargetsEquivalent = (
  left: CardFilingSuggestion | null,
  right: CardFilingSuggestion | null
) => {
  if (!left || !right || left.mode !== right.mode) {
    return false;
  }

  if (left.mode === 'manual_review') {
    return true;
  }

  if (left.mode === 'existing_category') {
    return (
      left.suggestedCategoryId === right.suggestedCategoryId ||
      (
        left.suggestedCategoryRange === right.suggestedCategoryRange &&
        left.suggestedCategoryTitle === right.suggestedCategoryTitle
      )
    );
  }

  return (
    left.suggestedParentRange === right.suggestedParentRange &&
    left.suggestedNewCategoryTitle === right.suggestedNewCategoryTitle
  );
};

export const useAiFiling = ({
  allCategories,
  categoryTree,
  cards,
  editingCardId,
  getEndpoint,
  getCurrentDraft,
  setThinkingState,
  clearAiProgress,
  timeoutMs,
}: UseAiFilingParams) => {
  const [aiSuggestion, setAiSuggestionState] = useState<CardFilingSuggestion | null>(null);
  const [aiSuggestionStatus, setAiSuggestionStatus] = useState<FilingSuggestionStatus | null>(null);
  const [isSuggestingFiling, setIsSuggestingFiling] = useState(false);
  const filingSuggestionCacheRef = useRef(new Map<string, CardFilingSuggestion>());
  const filingSuggestionInFlightRef = useRef(new Map<string, Promise<CardFilingSuggestion>>());
  const activeFilingRequestIdRef = useRef(0);

  const patchThinkingState = useCallback((updater: (previousState: ThinkingState) => ThinkingState) => {
    setThinkingState(previousState => (previousState ? updater(previousState) : previousState));
  }, [setThinkingState]);

  const applyThinkingResult = useCallback((suggestion: CardFilingSuggestion) => {
    patchThinkingState(previousState => applyFilingThinkingResult(previousState, suggestion));
  }, [patchThinkingState]);

  const setAiSuggestion = useCallback((suggestion: CardFilingSuggestion | null) => {
    setAiSuggestionState(suggestion ? ensureManualReviewFilingWhy(suggestion) : null);
    if (!suggestion) {
      setAiSuggestionStatus(null);
    }
  }, []);

  const cancelActiveFilingSuggestionWork = useCallback(() => {
    activeFilingRequestIdRef.current += 1;
    setIsSuggestingFiling(false);
    setThinkingState(null);
    clearAiProgress?.();
  }, [clearAiProgress, setThinkingState]);

  const requestFilingSuggestion = useCallback(async (
    rejectedSuggestion?: CardFilingSuggestion | null,
    draftOverride?: AiAssistPayload['draft']
  ) => {
    const draft = getCurrentDraft(draftOverride);
    if (!draft.title.trim() && !draft.content.trim()) {
      Alert.alert('Add A Draft First', 'Write a title or main idea before asking AI to suggest a filing location.');
      return;
    }

    const requestId = activeFilingRequestIdRef.current + 1;
    activeFilingRequestIdRef.current = requestId;
    const endpoint = getEndpoint();
    const filingPlan = buildFilingPlanV2({
      draft,
      categories: allCategories,
      cards,
      editingCardId,
      rejectedSuggestion,
    });
    const payload = buildAiAssistPayload({
      draft,
      rejectedSuggestion,
      semanticHints: filingPlan.payload.semanticHints ?? [],
      filingPlan,
      categoryTree,
      allCategories,
    });
    const cacheKey = `ai-authoritative:${buildAiRequestCacheKey(endpoint, payload)}`;
    const localPreviewSuggestion = {
      ...filingPlan.quickSuggestion,
      reasoning: 'Using the strongest local filing preview while AI checks the filing in the background.',
    };

    setIsSuggestingFiling(true);
    clearAiProgress?.();
    setThinkingState(createFilingThinkingState(filingPlan.preview));
    setAiSuggestion(localPreviewSuggestion);
    setAiSuggestionStatus('local_preview');

    try {
      const cachedSuggestion = filingSuggestionCacheRef.current.get(cacheKey);
      if (cachedSuggestion) {
        if (activeFilingRequestIdRef.current !== requestId) {
          return;
        }

        applyThinkingResult(cachedSuggestion);
        setAiSuggestion(cachedSuggestion);
        setAiSuggestionStatus(
          areFilingTargetsEquivalent(localPreviewSuggestion, cachedSuggestion) ? 'ai_confirmed' : 'ai_revised'
        );
        return;
      }

      let requestPromise = filingSuggestionInFlightRef.current.get(cacheKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          const { response, data } = await fetchJsonWithTimeout<{ suggestion?: CardFilingSuggestion; error?: string }>(
            endpoint,
            payload,
            timeoutMs
          );

          if (!response.ok || !data.suggestion) {
            throw new Error(data.error || 'The AI assistant did not return a suggestion.');
          }

          const fullSuggestion = finalizeFilingSuggestion({
            suggestion: data.suggestion,
            draft,
            filingPlan,
            allCategories,
            cards,
            editingCardId,
          });
          rememberCachedAiValue(filingSuggestionCacheRef.current, cacheKey, fullSuggestion);
          return fullSuggestion;
        })().finally(() => {
          filingSuggestionInFlightRef.current.delete(cacheKey);
        });

        filingSuggestionInFlightRef.current.set(cacheKey, requestPromise);
      }

      const fullSuggestion = await requestPromise;
      if (activeFilingRequestIdRef.current !== requestId) {
        return;
      }

      applyThinkingResult(fullSuggestion);
      setAiSuggestion(fullSuggestion);
      setAiSuggestionStatus(
        areFilingTargetsEquivalent(localPreviewSuggestion, fullSuggestion) ? 'ai_confirmed' : 'ai_revised'
      );
    } catch (error) {
      if (activeFilingRequestIdRef.current !== requestId) {
        return;
      }
      const fallbackSuggestion = buildTimedOutLocalFilingFallbackSuggestion({
        draft,
        filingPlan,
        allCategories,
        cards,
        editingCardId,
      });
      applyThinkingResult(fallbackSuggestion);
      setAiSuggestion(fallbackSuggestion);
      setAiSuggestionStatus('local_fallback');

      const message = error instanceof Error ? error.message : 'The AI assistant could not be reached.';
      Alert.alert(
        'AI Assist Slowed Down',
        `${message}\n\nSecond Mind kept its strongest local filing preview with moderate confidence. You can still review it or ask for a different filing suggestion.`
      );
    } finally {
      if (activeFilingRequestIdRef.current === requestId) {
        setIsSuggestingFiling(false);
        setThinkingState(currentState => currentState?.kind === 'filing' ? null : currentState);
      }
    }
  }, [
    allCategories,
    applyThinkingResult,
    cards,
    categoryTree,
    clearAiProgress,
    editingCardId,
    getCurrentDraft,
    getEndpoint,
    setThinkingState,
    timeoutMs,
  ]);

  const requestDifferentFilingSuggestion = useCallback(() => {
    if (!aiSuggestion) {
      void requestFilingSuggestion();
      return;
    }

    void requestFilingSuggestion(aiSuggestion);
  }, [aiSuggestion, requestFilingSuggestion]);

  const selectAlternativeFilingSuggestion = useCallback((index: number) => {
    if (!aiSuggestion?.alternativeSuggestions?.[index]) {
      return;
    }

    const selectedSuggestion = normalizeHierarchicalSuggestion({
      suggestion: aiSuggestion.alternativeSuggestions[index],
      cards,
      editingCardId,
      allCategories,
    });
    const remainingAlternatives = (aiSuggestion.alternativeSuggestions ?? [])
      .filter((_, candidateIndex) => candidateIndex !== index)
      .map(candidate => ({
        ...candidate,
        alternativeSuggestions: [],
      }));

    setAiSuggestion({
      ...selectedSuggestion,
      alternativeSuggestions: remainingAlternatives,
    });
  }, [aiSuggestion, allCategories, cards, editingCardId]);

  return {
    aiSuggestion,
    aiSuggestionStatus,
    setAiSuggestion,
    setAiSuggestionStatus,
    isSuggestingFiling,
    cancelActiveFilingSuggestionWork,
    requestFilingSuggestion,
    requestDifferentFilingSuggestion,
    selectAlternativeFilingSuggestion,
  };
};
