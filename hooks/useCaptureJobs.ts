import { useCallback, useMemo } from 'react';
import {
  CaptureClassificationResult,
  CaptureJob,
  CaptureJobStatus,
  CaptureRoute,
  CaptureStructuringResult,
  InboxCapture,
  TodoGenerationResult,
} from '../types';
import {
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

  const persistJobs = useCallback(async (nextJobs: CaptureJob[]) => {
    const pruned = pruneCaptureJobs(nextJobs, inboxCaptures);
    await saveCaptureJobs(pruned);
    return pruned;
  }, [inboxCaptures, saveCaptureJobs]);

  const updateJob = useCallback(async (
    jobId: string,
    patch: Partial<CaptureJob>
  ): Promise<CaptureJob | null> => {
    const existing = getCaptureJobById(jobs, jobId);
    if (!existing) {
      return null;
    }

    const nextJob = touchCaptureJob(existing, patch);
    await persistJobs(upsertCaptureJob(jobs, nextJob));
    return nextJob;
  }, [jobs, persistJobs]);

  const createJobForCapture = useCallback(async (captureId: string): Promise<CaptureJob> => {
    const existing = getCaptureJobForCapture(jobs, captureId);
    if (existing && !['completed', 'failed'].includes(existing.status)) {
      return existing;
    }

    const job = createCaptureJob(captureId);
    await persistJobs(upsertCaptureJob(jobs, job));
    return job;
  }, [jobs, persistJobs]);

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
      error: undefined,
    });
  }, [updateJob]);

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
    pruneJobs: () => persistJobs(pruneCaptureJobs(jobs, inboxCaptures)),
  };
};