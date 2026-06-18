import { useCallback, useRef } from 'react';
import {
  CaptureClassificationResult,
  CaptureStructuringResult,
  InboxCapture,
  Todo,
  TodoGenerationResult,
} from '../types';
import { buildLocalCaptureDraft, buildCapturePayload, mergeCaptureStructuring } from '../utils/aiCataloguing';
import { buildAiRequestCacheKey, fetchJsonWithTimeout } from '../utils/aiRequests';
import {
  applyEnrichmentToCapture,
  buildClassificationLocalSignals,
  buildLocalClassificationFallback,
  buildLocalTodoGenerationResult,
  buildUserOverrideClassification,
  inferObviousCaptureRoute,
  mapTodoGenerationToTodos,
  mapTodosToGenerationDrafts,
} from '../utils/captureJobs';
import { parseTodosFromCapture } from '../utils/todoParsing';
import { ensureTodoSortOrders } from '../utils/todoTree';
import { useCaptureJobs } from './useCaptureJobs';

const AI_RESPONSE_CACHE_LIMIT = 40;
const CLASSIFY_CAPTURE_TIMEOUT_MS = 12_000;
const ENRICH_CAPTURE_TIMEOUT_MS = 18_000;
const GENERATE_TODOS_TIMEOUT_MS = 18_000;

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

type CaptureJobsApi = ReturnType<typeof useCaptureJobs>;

interface UseCaptureRoutingParams {
  getAiBaseEndpoint: () => string;
  captureJobsApi: CaptureJobsApi;
  getInboxCaptures: () => InboxCapture[];
  saveInboxCaptures: (captures: InboxCapture[]) => Promise<void>;
  getTodos: () => Todo[];
  saveTodos: (todos: Todo[]) => Promise<void>;
  getCardAddresses: () => string[];
}

export const useCaptureRouting = ({
  getAiBaseEndpoint,
  captureJobsApi,
  getInboxCaptures,
  saveInboxCaptures,
  getTodos,
  saveTodos,
  getCardAddresses,
}: UseCaptureRoutingParams) => {
  const classifyCacheRef = useRef(new Map<string, CaptureClassificationResult>());
  const classifyInFlightRef = useRef(new Map<string, Promise<CaptureClassificationResult>>());
  const enrichCacheRef = useRef(new Map<string, CaptureStructuringResult>());
  const enrichInFlightRef = useRef(new Map<string, Promise<CaptureStructuringResult>>());
  const generateCacheRef = useRef(new Map<string, TodoGenerationResult>());
  const generateInFlightRef = useRef(new Map<string, Promise<TodoGenerationResult>>());

  const getClassifyEndpoint = useCallback(
    () => `${getAiBaseEndpoint().replace(/\/+$/, '')}/api/classify-capture`,
    [getAiBaseEndpoint]
  );

  const getEnrichEndpoint = useCallback(
    () => `${getAiBaseEndpoint().replace(/\/+$/, '')}/api/enrich-card-capture`,
    [getAiBaseEndpoint]
  );

  const getGenerateTodosEndpoint = useCallback(
    () => `${getAiBaseEndpoint().replace(/\/+$/, '')}/api/generate-todos`,
    [getAiBaseEndpoint]
  );

  const requestCaptureClassification = useCallback(async (
    capture: InboxCapture,
    userOverride?: 'card' | 'todo' | null
  ): Promise<CaptureClassificationResult> => {
    if (userOverride === 'card' || userOverride === 'todo') {
      return buildUserOverrideClassification(userOverride);
    }

    const localSignals = buildClassificationLocalSignals(capture.title, capture.content);
    const obvious = inferObviousCaptureRoute(capture.title, capture.content, localSignals);
    if (obvious) {
      return obvious;
    }

    const payload = {
      capture: {
        id: capture.id,
        title: capture.title,
        content: capture.content,
        sourceText: capture.sourceText,
        createdAt: capture.createdAt,
      },
      hints: {
        userOverride: userOverride ?? null,
        localSignals,
      },
    };
    const endpoint = getClassifyEndpoint();
    const cacheKey = buildAiRequestCacheKey(endpoint, payload);
    const cached = classifyCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let requestPromise = classifyInFlightRef.current.get(cacheKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          const { response, data } = await fetchJsonWithTimeout<{ result?: CaptureClassificationResult; error?: string }>(
            endpoint,
            payload,
            CLASSIFY_CAPTURE_TIMEOUT_MS
          );

          if (!response.ok || !data.result) {
            throw new Error(data.error || 'Capture classification failed.');
          }

          return data.result;
        })().finally(() => {
          classifyInFlightRef.current.delete(cacheKey);
        });

        classifyInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(classifyCacheRef.current, cacheKey, result);
      return result;
    } catch {
      const fallback = buildLocalClassificationFallback(
        capture.title,
        capture.content,
        localSignals,
        userOverride
      );
      rememberCachedAiValue(classifyCacheRef.current, cacheKey, fallback);
      return fallback;
    }
  }, [getClassifyEndpoint]);

  const requestCaptureEnrichment = useCallback(async (
    capture: InboxCapture
  ): Promise<CaptureStructuringResult> => {
    const localDraft = buildLocalCaptureDraft(capture);
    const payload = buildCapturePayload(capture, localDraft.result);
    const endpoint = getEnrichEndpoint();
    const cacheKey = buildAiRequestCacheKey(endpoint, payload);
    const cached = enrichCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!localDraft.shouldUseAi) {
      return {
        ...localDraft.result,
        strategy: 'local',
        confidenceBand: 'low',
      };
    }

    try {
      let requestPromise = enrichInFlightRef.current.get(cacheKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          const { response, data } = await fetchJsonWithTimeout<{ result?: CaptureStructuringResult; error?: string }>(
            endpoint,
            payload,
            ENRICH_CAPTURE_TIMEOUT_MS
          );

          if (!response.ok || !data.result) {
            throw new Error(data.error || 'Capture enrichment failed.');
          }

          return mergeCaptureStructuring(localDraft.result, data.result);
        })().finally(() => {
          enrichInFlightRef.current.delete(cacheKey);
        });

        enrichInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(enrichCacheRef.current, cacheKey, result);
      return result;
    } catch {
      const fallback: CaptureStructuringResult = {
        ...localDraft.result,
        strategy: 'local',
        confidenceBand: 'low',
      };
      rememberCachedAiValue(enrichCacheRef.current, cacheKey, fallback);
      return fallback;
    }
  }, [getEnrichEndpoint]);

  const requestTodoGeneration = useCallback(async (
    capture: InboxCapture
  ): Promise<TodoGenerationResult> => {
    const parsedTodos = parseTodosFromCapture(capture.title, capture.content);
    const localDraft = {
      todos: mapTodosToGenerationDrafts(parsedTodos),
      strategy: 'local' as const,
    };
    const payload = {
      capture: {
        id: capture.id,
        title: capture.title,
        content: capture.content,
        sourceText: capture.sourceText,
        createdAt: capture.createdAt,
      },
      localDraft,
      context: {
        existingCardAddresses: getCardAddresses().slice(0, 50),
      },
    };
    const endpoint = getGenerateTodosEndpoint();
    const cacheKey = buildAiRequestCacheKey(endpoint, payload);
    const cached = generateCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let requestPromise = generateInFlightRef.current.get(cacheKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          const { response, data } = await fetchJsonWithTimeout<{ result?: TodoGenerationResult; error?: string }>(
            endpoint,
            payload,
            GENERATE_TODOS_TIMEOUT_MS
          );

          if (!response.ok || !data.result) {
            throw new Error(data.error || 'Todo generation failed.');
          }

          return data.result;
        })().finally(() => {
          generateInFlightRef.current.delete(cacheKey);
        });

        generateInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(generateCacheRef.current, cacheKey, result);
      return result;
    } catch {
      const fallback = buildLocalTodoGenerationResult(parsedTodos);
      rememberCachedAiValue(generateCacheRef.current, cacheKey, fallback);
      return fallback;
    }
  }, [getCardAddresses, getGenerateTodosEndpoint]);

  const completeCardRoute = useCallback(async (
    jobId: string,
    capture: InboxCapture
  ) => {
    const enrichment = await requestCaptureEnrichment(capture);
    const latestCaptures = getInboxCaptures();
    const captureStillExists = latestCaptures.some(item => item.id === capture.id);
    if (!captureStillExists) {
      await captureJobsApi.markJobFailed(jobId, 'Capture was removed before enrichment finished.');
      return;
    }

    const updatedCaptures = latestCaptures.map(item => (
      item.id === capture.id
        ? applyEnrichmentToCapture(item, enrichment, jobId)
        : item
    ));
    await saveInboxCaptures(updatedCaptures);
    await captureJobsApi.recordEnrichment(jobId, enrichment);
  }, [
    captureJobsApi,
    getInboxCaptures,
    requestCaptureEnrichment,
    saveInboxCaptures,
  ]);

  const completeTodoRoute = useCallback(async (
    jobId: string,
    capture: InboxCapture
  ) => {
    const generation = await requestTodoGeneration(capture);
    const newTodos = mapTodoGenerationToTodos(generation.todos);
    if (newTodos.length === 0) {
      await captureJobsApi.markJobFailed(jobId, 'No todos could be generated from this capture.');
      return;
    }

    await saveTodos(ensureTodoSortOrders([...newTodos, ...getTodos()]));
    await saveInboxCaptures(getInboxCaptures().filter(item => item.id !== capture.id));
    await captureJobsApi.recordTodoGeneration(jobId, generation);
  }, [
    captureJobsApi,
    getInboxCaptures,
    getTodos,
    requestTodoGeneration,
    saveInboxCaptures,
    saveTodos,
  ]);

  const runCaptureJobPipeline = useCallback(async (
    jobId: string,
    capture: InboxCapture,
    options?: { userRouteOverride?: 'card' | 'todo' | null }
  ) => {
    try {
      const userRouteOverride = options?.userRouteOverride ?? null;
      let classification: CaptureClassificationResult;

      if (userRouteOverride === 'card' || userRouteOverride === 'todo') {
        classification = buildUserOverrideClassification(userRouteOverride);
        await captureJobsApi.recordClassification(jobId, classification);
      } else {
        await captureJobsApi.setJobStatus(jobId, 'classifying');
        classification = await requestCaptureClassification(capture, null);
        const updatedJob = await captureJobsApi.recordClassification(jobId, classification);
        if (!updatedJob) {
          return;
        }

        if (classification.needsClarification) {
          return;
        }
      }

      const route = userRouteOverride ?? classification.route;
      if (route === 'card') {
        await completeCardRoute(jobId, capture);
        return;
      }

      await completeTodoRoute(jobId, capture);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capture routing failed.';
      await captureJobsApi.markJobFailed(jobId, message);
    }
  }, [
    captureJobsApi,
    completeCardRoute,
    completeTodoRoute,
    requestCaptureClassification,
  ]);

  const submitQuickCapture = useCallback(async (capture: InboxCapture) => {
    const job = await captureJobsApi.createJobForCapture(capture.id);
    void runCaptureJobPipeline(job.id, capture);
    return job;
  }, [captureJobsApi, runCaptureJobPipeline]);

  const resumeCaptureJob = useCallback(async (
    jobId: string,
    userRouteOverride: 'card' | 'todo'
  ) => {
    const job = captureJobsApi.getJobById(jobId);
    if (!job) {
      return;
    }

    const capture = getInboxCaptures().find(item => item.id === job.captureId);
    if (!capture) {
      await captureJobsApi.markJobFailed(jobId, 'Capture no longer exists in the inbox.');
      return;
    }

    await captureJobsApi.applyUserRouteOverride(jobId, userRouteOverride);
    void runCaptureJobPipeline(jobId, capture, { userRouteOverride });
  }, [captureJobsApi, getInboxCaptures, runCaptureJobPipeline]);

  return {
    submitQuickCapture,
    runCaptureJobPipeline,
    resumeCaptureJob,
    requestCaptureClassification,
    requestCaptureEnrichment,
    requestTodoGeneration,
  };
};