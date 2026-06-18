import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import {
  AiAssistPayload,
  CardFilingSuggestion,
  CaptureStructuringResult,
  InboxCapture,
  ManagedCategory,
} from '../types';
import {
  buildCapturePayload,
  buildLocalCaptureDraft,
  mergeCaptureStructuring,
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

type LocalCaptureDraftLike = ReturnType<typeof buildLocalCaptureDraft>;

interface UseCaptureStructuringParams {
  categoryTree: ManagedCategory[];
  allCategories: ManagedCategory[];
  getCaptureStructuringEndpoint: () => string;
  getAiAssistEndpoint: () => string;
  captureTimeoutMs: number;
  filingFallbackTimeoutMs: number;
}

export const useCaptureStructuring = ({
  categoryTree,
  allCategories,
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

    return mergeCaptureStructuringResultV2(capture, {
      suggestedTitle: data.suggestion.suggestedTitle,
      suggestedContent: data.suggestion.suggestedContent,
      suggestedSource: data.suggestion.suggestedSource,
    });
  }, [allCategories, categoryTree, filingFallbackTimeoutMs, getAiAssistEndpoint]);

  const requestCaptureStructuring = useCallback(async (
    capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>,
    localDraft: LocalCaptureDraftLike
  ): Promise<CaptureStructuringResult | null> => {
    if (!capture.title.trim() && !capture.content.trim()) {
      Alert.alert('Add A Capture First', 'This inbox item needs some text before AI can structure it.');
      return null;
    }

    if (!localDraft.shouldUseAi) {
      return localDraft.result;
    }

    const endpoint = getCaptureStructuringEndpoint();
    const payload = buildCapturePayload(capture, localDraft.result);
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

          return mergeCaptureStructuring(localDraft.result, data.result);
        })().finally(() => {
          captureStructuringInFlightRef.current.delete(cacheKey);
        });

        captureStructuringInFlightRef.current.set(cacheKey, requestPromise);
      }

      const structuredResult = await requestPromise;
      rememberCachedAiValue(captureStructuringCacheRef.current, cacheKey, structuredResult);
      return structuredResult;
    } catch {
      return localDraft.result;
    }
  }, [captureTimeoutMs, getCaptureStructuringEndpoint, requestCaptureStructuringFallback]);

  return {
    requestCaptureStructuring,
  };
};
