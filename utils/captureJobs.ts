import {
  CaptureClassificationResult,
  CaptureClassifyLocalSignals,
  CaptureJob,
  CaptureJobStatus,
  CaptureRoute,
  CaptureStructuringResult,
  InboxCapture,
  InboxCaptureEnrichment,
  Todo,
  TodoGenerationDraft,
  TodoGenerationResult,
} from '../types';

const BULLET_LINE_PATTERN = /^([-*•]|\d+[.)])\s+/;
const SOURCE_CUE_PATTERN = /(https?:\/\/|www\.|page\s+\d|chapter\s+\d|—\s*[A-Z]|"\s*—|said\s+|according\s+to)/i;
const QUOTE_PATTERN = /^["'“‘].+["'”’]$/;
const TASK_VERB_PATTERN = /^(call|email|e-mail|text|buy|pick up|schedule|finish|send|pay|return|get|grab|water|mail|submit|review|fix|add|remind|pack|clean|organize)\b/i;
const IDEA_PATTERN = /\b(book idea|article idea|story idea|sermon idea|chapter idea|essay idea)\b/i;
const TASK_LIST_TITLE_PATTERN = /^(todo|tasks|errands|checklist|shopping list|grocery list)\b/i;

export const CAPTURE_JOB_PROCESSING_STATUSES: CaptureJobStatus[] = [
  'pending',
  'classifying',
  'enriching',
  'generating_todos',
];

export const CAPTURE_JOB_TERMINAL_STATUSES: CaptureJobStatus[] = [
  'completed',
  'failed',
];

export const MAX_CAPTURE_JOBS = 100;

export function buildUserOverrideClassification(route: CaptureRoute): CaptureClassificationResult {
  return {
    route,
    confidence: 1,
    confidenceBand: 'high',
    reasoning: 'User chose the capture route after clarification.',
    needsClarification: false,
  };
}

export function inferObviousCaptureRoute(
  title: string,
  content: string,
  localSignals: CaptureClassifyLocalSignals
): CaptureClassificationResult | null {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const lines = trimmedContent.split('\n').map(line => line.trim()).filter(Boolean);
  const listLineCount = localSignals.bulletLineCount + localSignals.numberedLineCount;
  const combined = `${trimmedTitle}\n${trimmedContent}`.trim();

  if (!combined) {
    return null;
  }

  if (IDEA_PATTERN.test(combined)) {
    return {
      route: 'card',
      confidence: 0.88,
      confidenceBand: 'high',
      reasoning: 'Creative idea seed language suggests a library note.',
      needsClarification: false,
    };
  }

  if (localSignals.hasSourceCues || localSignals.looksLikeQuote) {
    return {
      route: 'card',
      confidence: 0.85,
      confidenceBand: 'high',
      reasoning: 'Source or quote cues suggest a library note.',
      needsClarification: false,
    };
  }

  if (listLineCount >= 2 || TASK_LIST_TITLE_PATTERN.test(trimmedTitle)) {
    return {
      route: 'todo',
      confidence: 0.85,
      confidenceBand: 'high',
      reasoning: 'Structured task list formatting detected.',
      needsClarification: false,
    };
  }

  if (listLineCount === 1) {
    return {
      route: 'todo',
      confidence: 0.78,
      confidenceBand: 'medium',
      reasoning: 'A single bullet or numbered line suggests one actionable task.',
      needsClarification: false,
    };
  }

  const primaryLine = lines[0] || trimmedTitle;
  if (primaryLine && TASK_VERB_PATTERN.test(primaryLine)) {
    return {
      route: 'todo',
      confidence: 0.82,
      confidenceBand: 'high',
      reasoning: 'Imperative task language detected.',
      needsClarification: false,
    };
  }

  if (trimmedTitle && !trimmedContent && TASK_VERB_PATTERN.test(trimmedTitle)) {
    return {
      route: 'todo',
      confidence: 0.8,
      confidenceBand: 'high',
      reasoning: 'Short task-like title without body text.',
      needsClarification: false,
    };
  }

  if (listLineCount === 0 && trimmedContent.length >= 48 && !TASK_VERB_PATTERN.test(trimmedContent)) {
    return {
      route: 'card',
      confidence: 0.75,
      confidenceBand: 'medium',
      reasoning: 'Prose note without checklist structure.',
      needsClarification: false,
    };
  }

  if (trimmedContent.endsWith('?') && listLineCount === 0) {
    return {
      route: 'card',
      confidence: 0.72,
      confidenceBand: 'medium',
      reasoning: 'Open question notes are usually library material.',
      needsClarification: false,
    };
  }

  return null;
}

export function buildLocalClassificationFallback(
  title: string,
  content: string,
  localSignals: CaptureClassifyLocalSignals,
  userOverride?: CaptureRoute | null
): CaptureClassificationResult {
  if (userOverride === 'card' || userOverride === 'todo') {
    return buildUserOverrideClassification(userOverride);
  }

  const obvious = inferObviousCaptureRoute(title, content, localSignals);
  if (obvious) {
    return obvious;
  }

  return {
    route: 'card',
    confidence: 0.3,
    confidenceBand: 'low',
    reasoning: 'The capture could be either a library note or a task list.',
    needsClarification: true,
    clarificationPrompt: 'Is this a note for your library or a task list?',
  };
}

export function buildClassificationLocalSignals(title: string, content: string): CaptureClassifyLocalSignals {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  let bulletLineCount = 0;
  let numberedLineCount = 0;

  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) {
      bulletLineCount += 1;
    } else if (/^\d+[.)]\s+/.test(line)) {
      numberedLineCount += 1;
    }
  }

  const combined = `${title}\n${content}`;
  const hasSourceCues = SOURCE_CUE_PATTERN.test(combined);
  const looksLikeQuote = lines.some(line => QUOTE_PATTERN.test(line))
    || (lines.length === 1 && /^["'“‘]/.test(lines[0]));

  return {
    bulletLineCount,
    numberedLineCount,
    hasSourceCues,
    looksLikeQuote,
  };
}

export function createCaptureJob(captureId: string, jobId = `${Date.now()}-job`): CaptureJob {
  const now = new Date().toISOString();
  return {
    id: jobId,
    captureId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export function touchCaptureJob(job: CaptureJob, patch: Partial<CaptureJob>): CaptureJob {
  return {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function isProcessingCaptureJobStatus(status: CaptureJobStatus): boolean {
  return CAPTURE_JOB_PROCESSING_STATUSES.includes(status);
}

export function isTerminalCaptureJobStatus(status: CaptureJobStatus): boolean {
  return CAPTURE_JOB_TERMINAL_STATUSES.includes(status);
}

export function getActiveProcessingJobs(jobs: CaptureJob[]): CaptureJob[] {
  return jobs.filter(job => isProcessingCaptureJobStatus(job.status));
}

export function getAwaitingClarificationJobs(jobs: CaptureJob[]): CaptureJob[] {
  return jobs.filter(job => job.status === 'awaiting_clarification');
}

export function getCaptureJobForCapture(jobs: CaptureJob[], captureId: string): CaptureJob | undefined {
  return jobs.find(job => job.captureId === captureId);
}

export function getCaptureJobById(jobs: CaptureJob[], jobId: string): CaptureJob | undefined {
  return jobs.find(job => job.id === jobId);
}

export function upsertCaptureJob(jobs: CaptureJob[], nextJob: CaptureJob): CaptureJob[] {
  const index = jobs.findIndex(job => job.id === nextJob.id);
  if (index === -1) {
    return trimCaptureJobs([nextJob, ...jobs]);
  }

  const updated = [...jobs];
  updated[index] = nextJob;
  return trimCaptureJobs(updated);
}

export function trimCaptureJobs(jobs: CaptureJob[]): CaptureJob[] {
  if (jobs.length <= MAX_CAPTURE_JOBS) {
    return jobs;
  }

  const sorted = [...jobs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const keep = new Set<string>();

  for (const job of sorted) {
    if (!isTerminalCaptureJobStatus(job.status)) {
      keep.add(job.id);
    }
  }

  for (const job of sorted) {
    if (keep.size >= MAX_CAPTURE_JOBS) {
      break;
    }
    keep.add(job.id);
  }

  return sorted.filter(job => keep.has(job.id));
}

export function pruneCaptureJobs(jobs: CaptureJob[], inboxCaptures: InboxCapture[]): CaptureJob[] {
  const inboxIds = new Set(inboxCaptures.map(capture => capture.id));

  return trimCaptureJobs(
    jobs.filter(job => {
      if (inboxIds.has(job.captureId)) {
        return true;
      }

      if (job.status === 'awaiting_clarification') {
        return true;
      }

      return !isTerminalCaptureJobStatus(job.status);
    })
  );
}

export function mapTodosToGenerationDrafts(todos: Todo[]): TodoGenerationDraft[] {
  return todos.map(todo => ({
    clientId: todo.id,
    title: todo.title,
    content: todo.content,
    parentClientId: todo.parentId ?? null,
    sortOrder: todo.sortOrder,
    dueDate: todo.dueDate,
    relatedAddresses: todo.relatedAddresses,
  }));
}

export function mapTodoGenerationToTodos(
  drafts: TodoGenerationDraft[],
  baseTimestamp = Date.now()
): Todo[] {
  if (drafts.length === 0) {
    return [];
  }

  const createdAt = new Date().toISOString();
  const idByClientId = new Map<string, string>();

  drafts.forEach((draft, index) => {
    idByClientId.set(draft.clientId, `${baseTimestamp}-${index}`);
  });

  return drafts.map((draft, index) => {
    const parentId = draft.parentClientId
      ? idByClientId.get(draft.parentClientId)
      : undefined;

    return {
      id: idByClientId.get(draft.clientId) ?? `${baseTimestamp}-${index}`,
      title: draft.title.trim(),
      content: draft.content?.trim() || undefined,
      completed: false,
      parentId,
      sortOrder: draft.sortOrder ?? index,
      createdAt,
      dueDate: draft.dueDate,
      relatedAddresses: draft.relatedAddresses?.length ? draft.relatedAddresses : undefined,
    };
  });
}

export function buildLocalTodoGenerationResult(todos: Todo[]): TodoGenerationResult {
  return {
    todos: mapTodosToGenerationDrafts(todos),
    strategy: 'local',
    confidenceBand: 'low',
  };
}

export function getInboxCaptureStructuredDraft(
  capture: InboxCapture
): CaptureStructuringResult | undefined {
  return capture.enrichment?.structuredDraft;
}

export function inboxCaptureIsReadyToFile(capture: InboxCapture): boolean {
  return Boolean(getInboxCaptureStructuredDraft(capture));
}

export type InboxCaptureDisplayStatus =
  | 'processing'
  | 'ready_to_file'
  | 'awaiting_clarification'
  | 'failed'
  | 'raw';

export function getInboxCaptureDisplayStatus(
  capture: InboxCapture,
  job?: CaptureJob
): InboxCaptureDisplayStatus {
  if (job) {
    if (isProcessingCaptureJobStatus(job.status)) {
      return 'processing';
    }
    if (job.status === 'awaiting_clarification') {
      return 'awaiting_clarification';
    }
    if (job.status === 'failed') {
      return 'failed';
    }
  }

  if (inboxCaptureIsReadyToFile(capture)) {
    return 'ready_to_file';
  }

  return 'raw';
}

export function getInboxCaptureStatusLabel(status: InboxCaptureDisplayStatus): string | null {
  switch (status) {
    case 'processing':
      return 'Processing';
    case 'ready_to_file':
      return 'Ready to file';
    case 'awaiting_clarification':
      return 'Needs input';
    case 'failed':
      return 'Needs review';
    default:
      return null;
  }
}

export function getInboxCaptureDisplayTitle(capture: InboxCapture): string {
  const draft = getInboxCaptureStructuredDraft(capture);
  const title = draft?.suggestedTitle?.trim() || capture.title.trim();
  return title || 'Untitled capture';
}

export function getInboxCaptureDisplayPreview(capture: InboxCapture): string {
  const draft = getInboxCaptureStructuredDraft(capture);
  if (draft?.suggestedContent?.trim()) {
    return draft.suggestedContent.trim();
  }

  return capture.content.trim();
}

export function applyEnrichmentToCapture(
  capture: InboxCapture,
  enrichment: CaptureStructuringResult,
  jobId: string
): InboxCapture {
  const structuredDraft: InboxCaptureEnrichment = {
    structuredDraft: enrichment,
    enrichedAt: new Date().toISOString(),
    jobId,
  };

  return {
    ...capture,
    intendedType: 'card',
    enrichment: structuredDraft,
  };
}

export function resolveCaptureRoute(job: CaptureJob): CaptureRoute | null {
  if (job.userRouteOverride) {
    return job.userRouteOverride;
  }

  return job.classification?.route ?? null;
}

export interface CaptureProcessingJobView {
  jobId: string;
  captureId: string;
  status: CaptureJobStatus;
  previewTitle: string;
  previewContent: string;
}

export function getCaptureJobStatusLabel(status: CaptureJobStatus): string {
  switch (status) {
    case 'pending':
      return 'Queued';
    case 'classifying':
      return 'Classifying';
    case 'enriching':
      return 'Preparing card';
    case 'generating_todos':
      return 'Creating todos';
    case 'awaiting_clarification':
      return 'Needs your input';
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Failed';
    default:
      return 'Processing';
  }
}

export function buildCaptureJobPreview(capture?: InboxCapture): { previewTitle: string; previewContent: string } {
  if (!capture) {
    return {
      previewTitle: 'Capture',
      previewContent: 'Waiting for capture details...',
    };
  }

  return {
    previewTitle: capture.title.trim() || 'Untitled capture',
    previewContent: capture.content.trim() || 'No preview available.',
  };
}

export function buildCaptureProcessingJobViews(
  jobs: CaptureJob[],
  inboxCaptures: InboxCapture[]
): CaptureProcessingJobView[] {
  const captureById = new Map(inboxCaptures.map(capture => [capture.id, capture]));

  return getActiveProcessingJobs(jobs).map(job => {
    const preview = buildCaptureJobPreview(captureById.get(job.captureId));
    return {
      jobId: job.id,
      captureId: job.captureId,
      status: job.status,
      previewTitle: preview.previewTitle,
      previewContent: preview.previewContent,
    };
  });
}

export interface CaptureClarificationJobView {
  jobId: string;
  captureId: string;
  prompt: string;
  previewTitle: string;
  previewContent: string;
}

export function buildCaptureClarificationViews(
  jobs: CaptureJob[],
  inboxCaptures: InboxCapture[]
): CaptureClarificationJobView[] {
  const captureById = new Map(inboxCaptures.map(capture => [capture.id, capture]));

  return getAwaitingClarificationJobs(jobs).map(job => {
    const preview = buildCaptureJobPreview(captureById.get(job.captureId));
    return {
      jobId: job.id,
      captureId: job.captureId,
      prompt: job.classification?.clarificationPrompt?.trim()
        || 'This could be a library note or a task list. Which fits better?',
      previewTitle: preview.previewTitle,
      previewContent: preview.previewContent,
    };
  });
}

export function buildCaptureClarificationLabel(count: number): string {
  if (count <= 0) {
    return '';
  }

  return count === 1
    ? '1 capture needs your input'
    : `${count} captures need your input`;
}

export function buildCaptureProcessingLabel(count: number): string {
  if (count <= 0) {
    return '';
  }

  return count === 1
    ? 'Processing 1 capture'
    : `Processing ${count} captures`;
}

export function countLinesMatchingBullets(content: string): number {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => BULLET_LINE_PATTERN.test(line))
    .length;
}