import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import {
  Card,
  CardFilingSuggestion,
  CaptureStructuringResult,
  InboxCapture,
  ManagedCategory,
} from '../types';
import {
  buildCapturePayload,
  buildExistingCardSummariesForEnrichment,
  buildMinimalCaptureStructuringDraft,
  restrainStructuringToCapture,
} from '../utils/aiCataloguing';
import { buildAiAssistPayload } from '../utils/aiFiling';
import { buildAiRequestCacheKey, fetchJsonWithTimeout } from '../utils/aiRequests';
import { mergeCaptureStructuringResultV2 } from '../utils/aiCaptureStructuring';
import { normalizeCardSource } from '../utils/antinet';

const AI_RESPONSE_CACHE_LIMIT = 40;

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

interface UseCaptureStructuringParams {
  categoryTree: ManagedCategory[];
  allCategories: ManagedCategory[];
  getCards: () => Card[];
  getCaptureStructuringEndpoint: () => string;
  getAiAssistEndpoint: () => string;
  captureTimeoutMs: number;
  filingFallbackTimeoutMs: number;
}

export const useCaptureStructuring = ({
  categoryTree,
  allCategories,
  getCards,
  getCaptureStructuringEndpoint,
  getAiAssistEndpoint,
  captureTimeoutMs,
  filingFallbackTimeoutMs,
}: UseCaptureStructuringParams) => {
  const captureStructuringCacheRef = useRef(new Map<string, CaptureStructuringResult>());
  const captureStructuringInFlightRef = useRef(new Map<string, Promise<CaptureStructuringResult>>());

  const requestCaptureStructuringFallback = useCallback(async (
    capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>
  ): Promise<CaptureStructuringResult> => {
    const { response, data } = await fetchJsonWithTimeout<{ suggestion?: CardFilingSuggestion; error?: string }>(
      getAiAssistEndpoint(),
      buildAiAssistPayload({
        draft: {
          address: '',
          title: capture.title,
          content: capture.content,
          tags: [],
          source: normalizeCardSource({
            type: 'Other',
            note: capture.sourceText,
          }),
        },
        categoryTree,
        allCategories,
      }),
      filingFallbackTimeoutMs
    );

    if (!response.ok || !data.suggestion) {
      throw new Error(data.error || 'The AI assistant did not return structured card fields.');
    }

    return restrainStructuringToCapture(capture, mergeCaptureStructuringResultV2(capture, {
      suggestedTitle: data.suggestion.suggestedTitle,
      suggestedContent: data.suggestion.suggestedContent,
      suggestedSource: data.suggestion.suggestedSource,
      strategy: 'ai',
    }));
  }, [allCategories, categoryTree, filingFallbackTimeoutMs, getAiAssistEndpoint]);

  const requestCaptureStructuring = useCallback(async (
    capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>
  ): Promise<CaptureStructuringResult | null> => {
    if (!capture.title.trim() && !capture.content.trim()) {
      Alert.alert('Add A Capture First', 'This inbox item needs some text before AI can structure it.');
      return null;
    }

    const minimalDraft = buildMinimalCaptureStructuringDraft(capture);
    const endpoint = getCaptureStructuringEndpoint();
    const payload = buildCapturePayload(capture, minimalDraft, {
      existingCards: buildExistingCardSummariesForEnrichment(getCards()),
    });
    const cacheKey = buildAiRequestCacheKey(endpoint, payload);
    const cachedResult = captureStructuringCacheRef.current.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      let requestPromise = captureStructuringInFlightRef.current.get(cacheKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          const { response, data } = await fetchJsonWithTimeout<{ result?: CaptureStructuringResult; error?: string }>(
            endpoint,
            payload,
            captureTimeoutMs
          );

          if (response.status === 404) {
            return await requestCaptureStructuringFallback(capture);
          }

          if (!response.ok || !data.result) {
            throw new Error(data.error || 'The AI assistant did not return structured card fields.');
          }

          return restrainStructuringToCapture(capture, {
            ...data.result,
            strategy: data.result.strategy ?? 'ai',
          });
        })().finally(() => {
          captureStructuringInFlightRef.current.delete(cacheKey);
        });

        captureStructuringInFlightRef.current.set(cacheKey, requestPromise);
      }

      const structuredResult = await requestPromise;
      rememberCachedAiValue(captureStructuringCacheRef.current, cacheKey, structuredResult);
      return structuredResult;
    } catch {
      return restrainStructuringToCapture(capture, minimalDraft);
    }
  }, [captureTimeoutMs, getCaptureStructuringEndpoint, getCards, requestCaptureStructuringFallback]);

  return {
    requestCaptureStructuring,
  };
};