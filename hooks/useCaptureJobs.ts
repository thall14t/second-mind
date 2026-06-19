import { useCallback, useMemo } from 'react';
import { useDataStore } from '../utils/stores/dataStore';
import {
  CaptureClassificationResult,
  CaptureClarificationState,
  CaptureJob,
  CaptureJobStatus,
  CaptureRoute,
  CaptureStructuringResult,
  InboxCapture,
  TodoGenerationResult,
} from '../types';
import {
  buildClassifyClarificationState,
  createCaptureJob,
  getActiveProcessingJobs,
  getAwaitingClarificationJobs,
  getCaptureJobById,
  getCaptureJobForCapture,
  pruneCaptureJobs,
  touchCaptureJob,
  upsertCaptureJob,
} from '../utils/captureJobs';

interface UseCaptureJobsParams {
  jobs: CaptureJob[];
  saveCaptureJobs: (jobs: CaptureJob[]) => Promise<void>;
  inboxCaptures: InboxCapture[];
}

export const useCaptureJobs = ({
  jobs,
  saveCaptureJobs,
  inboxCaptures,
}: UseCaptureJobsParams) => {
  const activeProcessingJobs = useMemo(
    () => getActiveProcessingJobs(jobs),
    [jobs]
  );

  const awaitingClarificationJobs = useMemo(
    () => getAwaitingClarificationJobs(jobs),
    [jobs]
  );

  const getCurrentJobs = useCallback(
    () => useDataStore.getState().captureJobs,
    []
  );

  const getCurrentInboxCaptures = useCallback(
    () => useDataStore.getState().inboxCaptures,
    []
  );

  const persistJobs = useCallback(async (nextJobs: CaptureJob[]) => {
    const pruned = pruneCaptureJobs(nextJobs, getCurrentInboxCaptures());
    await saveCaptureJobs(pruned);
    return pruned;
  }, [getCurrentInboxCaptures, saveCaptureJobs]);

  const updateJob = useCallback(async (
    jobId: string,
    patch: Partial<CaptureJob>
  ): Promise<CaptureJob | null> => {
    const currentJobs = getCurrentJobs();
    const existing = getCaptureJobById(currentJobs, jobId);
    if (!existing) {
      return null;
    }

    const nextJob = touchCaptureJob(existing, patch);
    await persistJobs(upsertCaptureJob(currentJobs, nextJob));
    return nextJob;
  }, [getCurrentJobs, persistJobs]);

  const createJobForCapture = useCallback(async (captureId: string): Promise<CaptureJob> => {
    const currentJobs = getCurrentJobs();
    const existing = getCaptureJobForCapture(currentJobs, captureId);
    if (existing && !['completed', 'failed'].includes(existing.status)) {
      return existing;
    }

    const job = createCaptureJob(captureId);
    await persistJobs(upsertCaptureJob(currentJobs, job));
    return job;
  }, [getCurrentJobs, persistJobs]);

  const setJobStatus = useCallback(async (
    jobId: string,
    status: CaptureJobStatus,
    extra: Partial<CaptureJob> = {}
  ) => updateJob(jobId, { status, ...extra }), [updateJob]);

  const recordClassification = useCallback(async (
    jobId: string,
    classification: CaptureClassificationResult
  ) => {
    const status: CaptureJobStatus = classification.needsClarification
      ? 'awaiting_clarification'
      : classification.route === 'card'
        ? 'enriching'
        : 'generating_todos';

    return updateJob(jobId, {
      status,
      classification,
      clarification: buildClassifyClarificationState(classification),
      error: undefined,
    });
  }, [updateJob]);

  const recordEnrichment = useCallback(async (
    jobId: string,
    enrichment: CaptureStructuringResult
  ) => updateJob(jobId, {
    enrichment,
    status: 'completed',
    error: undefined,
  }), [updateJob]);

  const recordTodoGeneration = useCallback(async (
    jobId: string,
    todoGeneration: TodoGenerationResult
  ) => updateJob(jobId, {
    todoGeneration,
    status: 'completed',
    error: undefined,
  }), [updateJob]);

  const markJobCompleted = useCallback(async (jobId: string) => (
    setJobStatus(jobId, 'completed')
  ), [setJobStatus]);

  const markJobFailed = useCallback(async (jobId: string, error: string) => (
    updateJob(jobId, { status: 'failed', error })
  ), [updateJob]);

  const applyUserRouteOverride = useCallback(async (
    jobId: string,
    route: CaptureRoute
  ) => {
    const status: CaptureJobStatus = route === 'card' ? 'enriching' : 'generating_todos';
    return updateJob(jobId, {
      userRouteOverride: route,
      status,
      clarification: undefined,
      error: undefined,
    });
  }, [updateJob]);

  const recordClarificationRequest = useCallback(async (
    jobId: string,
    clarification: CaptureClarificationState,
    partialTodoGeneration?: TodoGenerationResult
  ) => updateJob(jobId, {
    status: 'awaiting_clarification',
    clarification,
    todoGeneration: partialTodoGeneration,
    error: undefined,
  }), [updateJob]);

  const applyClarificationAnswer = useCallback(async (
    jobId: string,
    answer: string
  ) => {
    const job = getCaptureJobById(getCurrentJobs(), jobId);
    if (!job?.clarification) {
      return null;
    }

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      return null;
    }

    const entry = {
      stage: job.clarification.stage,
      prompt: job.clarification.prompt,
      answer: trimmedAnswer,
      answeredAt: new Date().toISOString(),
    };

    const nextStatus: CaptureJobStatus = job.clarification.stage === 'generate_todos'
      ? 'generating_todos'
      : (job.userRouteOverride === 'card' ? 'enriching' : 'generating_todos');

    return updateJob(jobId, {
      status: nextStatus,
      clarificationAnswers: [...(job.clarificationAnswers ?? []), entry],
      clarification: undefined,
      error: undefined,
    });
  }, [getCurrentJobs, updateJob]);

  return {
    jobs,
    activeProcessingJobs,
    awaitingClarificationJobs,
    activeProcessingCount: activeProcessingJobs.length,
    awaitingClarificationCount: awaitingClarificationJobs.length,
    getJobById: (jobId: string) => getCaptureJobById(jobs, jobId),
    getJobForCapture: (captureId: string) => getCaptureJobForCapture(jobs, captureId),
    createJobForCapture,
    updateJob,
    setJobStatus,
    recordClassification,
    recordEnrichment,
    recordTodoGeneration,
    markJobCompleted,
    markJobFailed,
    applyUserRouteOverride,
    recordClarificationRequest,
    applyClarificationAnswer,
    pruneJobs: () => persistJobs(pruneCaptureJobs(getCurrentJobs(), getCurrentInboxCaptures())),
  };
};