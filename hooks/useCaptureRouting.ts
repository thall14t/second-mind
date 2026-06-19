import { useCallback, useRef } from 'react';
import {
  CaptureClassificationResult,
  CaptureStructuringResult,
  CaptureJob,
  Card,
  CardFilingSuggestion,
  InboxCapture,
  ManagedCategory,
  Todo,
  TodoGenerationResult,
} from '../types';
import {
  buildCapturePayload,
  buildExistingCardSummariesForEnrichment,
  buildFilingPlanV2,
  buildMinimalCaptureStructuringDraft,
  restrainStructuringToCapture,
} from '../utils/aiCataloguing';
import {
  buildAiAssistPayload,
  buildDraftFromCaptureStructuring,
  finalizeFilingSuggestion,
} from '../utils/aiFiling';
import { buildAiRequestCacheKey, fetchJsonWithTimeout } from '../utils/aiRequests';
import {
  applyEnrichmentToCapture,
  buildAiUnavailableClassificationFallback,
  buildClassificationLocalSignals,
  buildTodoClarificationState,
  buildTodoGenerationClarificationContext,
  finalizeCaptureClassification,
  finalizeTodoGenerationResult,
  buildLocalTodoGenerationResult,
  buildUserOverrideClassification,
  MAX_CAPTURE_CLARIFICATION_ROUNDS,
} from '../utils/captureJobs';
import {
  buildExistingTodoSummariesForGeneration,
  buildLocalAppendTodoGeneration,
  mergeTodoGenerationIntoExisting,
} from '../utils/todoAppend';
import { parseTodosFromCapture } from '../utils/todoParsing';
import { ensureTodoSortOrders } from '../utils/todoTree';
import { useCaptureJobs } from './useCaptureJobs';

const AI_RESPONSE_CACHE_LIMIT = 40;
const CLASSIFY_CAPTURE_TIMEOUT_MS = 12_000;
const ENRICH_CAPTURE_TIMEOUT_MS = 18_000;
const GENERATE_TODOS_TIMEOUT_MS = 18_000;
const FILING_SUGGESTION_TIMEOUT_MS = 20_000;

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
  getAllCategories: () => ManagedCategory[];
  getCategoryTree: () => ManagedCategory[];
  getCards: () => Card[];
  getAiAssistEndpoint: () => string;
}

export const useCaptureRouting = ({
  getAiBaseEndpoint,
  captureJobsApi,
  getInboxCaptures,
  saveInboxCaptures,
  getTodos,
  saveTodos,
  getCardAddresses,
  getAllCategories,
  getCategoryTree,
  getCards,
  getAiAssistEndpoint,
}: UseCaptureRoutingParams) => {
  const classifyCacheRef = useRef(new Map<string, CaptureClassificationResult>());
  const classifyInFlightRef = useRef(new Map<string, Promise<CaptureClassificationResult>>());
  const enrichCacheRef = useRef(new Map<string, CaptureStructuringResult>());
  const enrichInFlightRef = useRef(new Map<string, Promise<CaptureStructuringResult>>());
  const generateCacheRef = useRef(new Map<string, TodoGenerationResult>());
  const generateInFlightRef = useRef(new Map<string, Promise<TodoGenerationResult>>());
  const filingCacheRef = useRef(new Map<string, CardFilingSuggestion>());
  const filingInFlightRef = useRef(new Map<string, Promise<CardFilingSuggestion>>());

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

  const getFilingEndpoint = useCallback(
    () => `${getAiAssistEndpoint().replace(/\/+$/, '')}/api/suggest-card-filing`,
    [getAiAssistEndpoint]
  );

  const requestCaptureClassification = useCallback(async (
    capture: InboxCapture,
    userOverride?: 'card' | 'todo' | null
  ): Promise<CaptureClassificationResult> => {
    if (userOverride === 'card' || userOverride === 'todo') {
      return buildUserOverrideClassification(userOverride);
    }

    const localSignals = buildClassificationLocalSignals(capture.title, capture.content);
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

          return finalizeCaptureClassification(data.result);
        })().finally(() => {
          classifyInFlightRef.current.delete(cacheKey);
        });

        classifyInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(classifyCacheRef.current, cacheKey, result);
      return result;
    } catch {
      const fallback = buildAiUnavailableClassificationFallback(
        capture.title,
        capture.content,
        localSignals
      );
      rememberCachedAiValue(classifyCacheRef.current, cacheKey, fallback);
      return fallback;
    }
  }, [getClassifyEndpoint]);

  const requestCaptureEnrichment = useCallback(async (
    capture: InboxCapture
  ): Promise<CaptureStructuringResult> => {
    const minimalDraft = buildMinimalCaptureStructuringDraft(capture);
    const payload = buildCapturePayload(capture, minimalDraft, {
      existingCards: buildExistingCardSummariesForEnrichment(getCards()),
    });
    const endpoint = getEnrichEndpoint();
    const cacheKey = buildAiRequestCacheKey(endpoint, payload);
    const cached = enrichCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
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

          return restrainStructuringToCapture(capture, {
            ...data.result,
            strategy: data.result.strategy ?? 'ai',
          });
        })().finally(() => {
          enrichInFlightRef.current.delete(cacheKey);
        });

        enrichInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(enrichCacheRef.current, cacheKey, result);
      return result;
    } catch {
      const fallback = restrainStructuringToCapture(capture, minimalDraft);
      rememberCachedAiValue(enrichCacheRef.current, cacheKey, fallback);
      return fallback;
    }
  }, [getCards, getEnrichEndpoint]);

  const requestTodoGeneration = useCallback(async (
    capture: InboxCapture,
    job?: CaptureJob
  ): Promise<TodoGenerationResult> => {
    const clarification = buildTodoGenerationClarificationContext(job);
    const payload = {
      capture: {
        id: capture.id,
        title: capture.title,
        content: capture.content,
        sourceText: capture.sourceText,
        createdAt: capture.createdAt,
      },
      localDraft: {
        todos: [],
        strategy: 'local' as const,
      },
      context: {
        existingCardAddresses: getCardAddresses().slice(0, 50),
        existingTodos: buildExistingTodoSummariesForGeneration(getTodos()),
      },
      ...(clarification ? { clarification } : {}),
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

          const clarificationRound = clarification?.round ?? 1;
          return finalizeTodoGenerationResult({
            ...data.result,
            strategy: data.result.strategy ?? 'ai',
          }, clarificationRound);
        })().finally(() => {
          generateInFlightRef.current.delete(cacheKey);
        });

        generateInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(generateCacheRef.current, cacheKey, result);
      return result;
    } catch {
      const existingTodos = getTodos();
      const appendFallback = buildLocalAppendTodoGeneration(capture, existingTodos);
      const fallback = appendFallback ?? buildLocalTodoGenerationResult(
        parseTodosFromCapture(capture.title, capture.content)
      );
      rememberCachedAiValue(generateCacheRef.current, cacheKey, fallback);
      return fallback;
    }
  }, [getCardAddresses, getGenerateTodosEndpoint, getTodos]);

  const requestCaptureFiling = useCallback(async (
    enrichment: CaptureStructuringResult
  ): Promise<CardFilingSuggestion | null> => {
    const draft = buildDraftFromCaptureStructuring(enrichment);
    const cards = getCards();
    const allCategories = getAllCategories();
    const filingPlan = buildFilingPlanV2({
      draft,
      categories: allCategories,
      cards,
    });
    const payload = buildAiAssistPayload({
      draft,
      filingPlan,
      categoryTree: getCategoryTree(),
      allCategories,
    });
    const endpoint = getFilingEndpoint();
    const cacheKey = buildAiRequestCacheKey(endpoint, payload);
    const cached = filingCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let requestPromise = filingInFlightRef.current.get(cacheKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          const { response, data } = await fetchJsonWithTimeout<{ suggestion?: CardFilingSuggestion; error?: string }>(
            endpoint,
            payload,
            FILING_SUGGESTION_TIMEOUT_MS
          );

          if (!response.ok || !data.suggestion) {
            throw new Error(data.error || 'Capture filing suggestion failed.');
          }

          return finalizeFilingSuggestion({
            suggestion: data.suggestion,
            draft,
            filingPlan,
            allCategories,
            cards,
          });
        })().finally(() => {
          filingInFlightRef.current.delete(cacheKey);
        });

        filingInFlightRef.current.set(cacheKey, requestPromise);
      }

      const result = await requestPromise;
      rememberCachedAiValue(filingCacheRef.current, cacheKey, result);
      return result;
    } catch {
      return null;
    }
  }, [getAllCategories, getCategoryTree, getCards, getFilingEndpoint]);

  const completeCardRoute = useCallback(async (
    jobId: string,
    capture: InboxCapture
  ) => {
    const enrichment = await requestCaptureEnrichment(capture);
    const filingSuggestion = await requestCaptureFiling(enrichment);
    const latestCaptures = getInboxCaptures();
    const captureStillExists = latestCaptures.some(item => item.id === capture.id);
    if (!captureStillExists) {
      await captureJobsApi.markJobFailed(jobId, 'Capture was removed before enrichment finished.');
      return;
    }

    const updatedCaptures = latestCaptures.map(item => (
      item.id === capture.id
        ? applyEnrichmentToCapture(item, enrichment, jobId, filingSuggestion)
        : item
    ));
    await saveInboxCaptures(updatedCaptures);
    await captureJobsApi.recordEnrichment(jobId, enrichment);
  }, [
    captureJobsApi,
    getInboxCaptures,
    requestCaptureEnrichment,
    requestCaptureFiling,
    saveInboxCaptures,
  ]);

  const completeTodoRoute = useCallback(async (
    jobId: string,
    capture: InboxCapture
  ) => {
    const job = captureJobsApi.getJobById(jobId);
    const generation = await requestTodoGeneration(capture, job ?? undefined);
    const clarificationRound = job?.clarificationAnswers?.filter(entry => entry.stage === 'generate_todos').length ?? 0;
    const clarificationState = buildTodoClarificationState(
      generation,
      clarificationRound + 1
    );

    if (
      clarificationState
      && clarificationRound + 1 < MAX_CAPTURE_CLARIFICATION_ROUNDS
    ) {
      await captureJobsApi.recordClarificationRequest(jobId, clarificationState, generation);
      return;
    }

    const existingTodos = getTodos();
    const mergedTodos = mergeTodoGenerationIntoExisting(generation, existingTodos, capture);
    const newTodoCount = mergedTodos.length - existingTodos.length;
    if (newTodoCount === 0) {
      await captureJobsApi.markJobFailed(jobId, 'No todos could be generated from this capture.');
      return;
    }

    await saveTodos(ensureTodoSortOrders(mergedTodos));
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
    options?: {
      userRouteOverride?: 'card' | 'todo' | null;
      resumeFromTodoGeneration?: boolean;
    }
  ) => {
    try {
      const userRouteOverride = options?.userRouteOverride ?? null;
      const resumeFromTodoGeneration = options?.resumeFromTodoGeneration ?? false;
      const existingJob = captureJobsApi.getJobById(jobId);
      let classification: CaptureClassificationResult | undefined = existingJob?.classification;

      if (resumeFromTodoGeneration) {
        if (!classification && userRouteOverride) {
          classification = buildUserOverrideClassification(userRouteOverride);
        }
        if (!classification || (classification.route !== 'todo' && userRouteOverride !== 'todo')) {
          await captureJobsApi.markJobFailed(jobId, 'Todo clarification resume failed because route was not todo.');
          return;
        }

        await captureJobsApi.setJobStatus(jobId, 'generating_todos');
        await completeTodoRoute(jobId, capture);
        return;
      }

      if (userRouteOverride === 'card' || userRouteOverride === 'todo') {
        classification = buildUserOverrideClassification(userRouteOverride);
        await captureJobsApi.recordClassification(jobId, classification);
      } else if (!classification) {
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

      const route = userRouteOverride ?? classification?.route;
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

  const resumeCaptureClarification = useCallback(async (
    jobId: string,
    answer: string
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

    const updatedJob = await captureJobsApi.applyClarificationAnswer(jobId, answer);
    if (!updatedJob) {
      return;
    }

    void runCaptureJobPipeline(jobId, capture, { resumeFromTodoGeneration: true });
  }, [captureJobsApi, getInboxCaptures, runCaptureJobPipeline]);

  return {
    submitQuickCapture,
    runCaptureJobPipeline,
    resumeCaptureJob,
    resumeCaptureClarification,
    requestCaptureClassification,
    requestCaptureEnrichment,
    requestTodoGeneration,
  };
};