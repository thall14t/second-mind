import {
  CaptureClassificationResult,
  CaptureClassifyLocalSignals,
  CaptureClarificationState,
  CaptureJob,
  CaptureJobStatus,
  CaptureRoute,
  CaptureStructuringResult,
  CaptureTodoClarificationContext,
  CardFilingSuggestion,
  InboxCapture,
  InboxCaptureEnrichment,
  Todo,
  TodoGenerationDraft,
  TodoGenerationResult,
} from '../types';

const BULLET_LINE_PATTERN = /^([-*•]|\d+[.)])\s+/;
const SOURCE_CUE_PATTERN = /(https?:\/\/|www\.|page\s+\d|chapter\s+\d|—\s*[A-Z]|"\s*—|said\s+|according\s+to)/i;
const QUOTE_PATTERN = /^["'“‘].+["'”’]$/;
const TASK_VERB_PATTERN = /^(call|email|e-mail|text|buy|pick up|schedule|finish|send|pay|return|get|grab|water|mail|submit|review|fix|add|remind|pack|clean|organize|do|make|run|take|put|throw|hang|sort|move|set|check|change|replace|install|repair|pick|drop|feed|walk)\b/i;
const CHORE_VERB_PATTERN = /^(vacuum|mop|dust|sweep|fold|wash|wipe|scrub|empty|load|unload|rake|mow|weed|iron|tidy|sanitize|rinse|polish|shampoo|defrost|descale|unclog|declutter|disinfect|bleach|squeegee|deodorize|straighten)\b/i;
const IDEA_PATTERN = /\b(book idea|article idea|story idea|sermon idea|chapter idea|essay idea)\b/i;
const TASK_LIST_TITLE_PATTERN = /^(todo|tasks|to-?do|errands|checklist|shopping list|grocery list|chores|house chores|cleaning(?: list)?|weekend tasks)\b/i;
const TASK_LIST_FRAMING_PATTERN = /\b(chores?|errands?|to-?do(?:\s+list)?|checklist|shopping\s+list|grocery\s+list|cleaning(?:\s+list)?|house(?:hold)?\s+(?:chores?|tasks?)|weekend\s+tasks?|honey-?do)\b/i;
const CONCEPTUAL_NUMBERED_PATTERN = /^\d+[.)]\s+.*\b(is|are|was|were|means|suggests|implies|shapes|creates|cultivated)\b/i;
const APHORISM_SPIRITUAL_PATTERN = /\b(our\s+)?(lord|god|christ|jesus|spirit|faith|love|grace|truth|hope|peace)\b/i;
const DECLARATIVE_IS_PATTERN = /^[A-Za-z"'“‘][\w\s'’”]{0,60}\s+(is|are|was|were|becomes?)\s+/i;
const TASK_NEED_PATTERN = /\b(?:i\s+)?need\s+to\b/i;
const TASK_OBLIGATION_PATTERN = /\b(?:have\s+to|must|should|got\s+to)\b/i;
const TASK_BY_DATE_PATTERN = /\bby\s+(?:this\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next\s+\w+|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i;
const INCLUDING_TASKS_PATTERN = /\bincluding\s+.+/i;
const APPEND_TO_LIST_PATTERN = /\b(?:add|append|include|put)\s+.+\s+(?:to|on|into)\s+(?:the\s+|my\s+|that\s+)?(?:list|.+)$/i;

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

function looksLikeActionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 96) {
    return false;
  }

  if (BULLET_LINE_PATTERN.test(trimmed)) {
    return true;
  }

  if (TASK_VERB_PATTERN.test(trimmed) || CHORE_VERB_PATTERN.test(trimmed)) {
    return true;
  }

  if (CONCEPTUAL_NUMBERED_PATTERN.test(trimmed)) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 2 && wordCount <= 10 && !/[.!?]/.test(trimmed) && !DECLARATIVE_IS_PATTERN.test(trimmed)) {
    return true;
  }

  return wordCount === 1 && trimmed.length <= 32 && !DECLARATIVE_IS_PATTERN.test(trimmed);
}

function countActionLikeLines(lines: string[]): number {
  return lines.filter(looksLikeActionLine).length;
}

function hasTaskListFraming(title: string, content: string): boolean {
  const combined = `${title}\n${content}`.trim();
  return TASK_LIST_TITLE_PATTERN.test(title.trim()) || TASK_LIST_FRAMING_PATTERN.test(combined);
}

function looksLikePlainTaskList(title: string, content: string, lines: string[]): boolean {
  if (lines.length === 0) {
    return false;
  }

  if (hasTaskListFraming(title, content) && lines.length >= 1) {
    return true;
  }

  const actionLikeLineCount = countActionLikeLines(lines);
  if (lines.length >= 2 && actionLikeLineCount >= 2) {
    return true;
  }

  if (lines.length === 1) {
    const commaSegments = lines[0].split(/,\s+/).map(segment => segment.trim()).filter(Boolean);
    if (commaSegments.length >= 3 && countActionLikeLines(commaSegments) >= 2) {
      return true;
    }
  }

  return false;
}

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

  if (APPEND_TO_LIST_PATTERN.test(combined)) {
    return {
      route: 'todo',
      confidence: 0.9,
      confidenceBand: 'high',
      reasoning: 'Append-to-list language suggests adding tasks to an existing todo list.',
      needsClarification: false,
    };
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

  if (looksLikePlainTaskList(trimmedTitle, trimmedContent, lines)) {
    return {
      route: 'todo',
      confidence: 0.87,
      confidenceBand: 'high',
      reasoning: 'Multiple action lines or task-list framing suggests a chore or errand list.',
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

  if (
    lines.length <= 1
    && combined.length <= 96
    && !TASK_VERB_PATTERN.test(primaryLine)
    && !TASK_NEED_PATTERN.test(combined)
    && (
      APHORISM_SPIRITUAL_PATTERN.test(primaryLine)
      || DECLARATIVE_IS_PATTERN.test(primaryLine)
    )
  ) {
    return {
      route: 'card',
      confidence: 0.86,
      confidenceBand: 'high',
      reasoning: 'Short declarative note without task language suggests a library card.',
      needsClarification: false,
    };
  }

  if (
    TASK_NEED_PATTERN.test(combined)
    || TASK_OBLIGATION_PATTERN.test(combined)
    || (INCLUDING_TASKS_PATTERN.test(combined) && TASK_VERB_PATTERN.test(combined))
  ) {
    if (
      TASK_BY_DATE_PATTERN.test(combined)
      || INCLUDING_TASKS_PATTERN.test(combined)
      || TASK_VERB_PATTERN.test(primaryLine)
    ) {
      return {
        route: 'todo',
        confidence: 0.88,
        confidenceBand: 'high',
        reasoning: 'Action language with a deadline or included subtasks suggests a task list.',
        needsClarification: false,
      };
    }
  }
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

  if (
    listLineCount === 0
    && trimmedContent.length >= 48
    && !TASK_VERB_PATTERN.test(trimmedContent)
    && !CHORE_VERB_PATTERN.test(trimmedContent)
    && !looksLikePlainTaskList(trimmedTitle, trimmedContent, lines)
  ) {
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

const CLASSIFICATION_CLARIFICATION_MAX_CONFIDENCE = 0.42;

export const MAX_CAPTURE_CLARIFICATION_ROUNDS = 2;

export function finalizeCaptureClassification(
  result: CaptureClassificationResult
): CaptureClassificationResult {
  if (!result.needsClarification) {
    return result;
  }

  if (result.confidence >= CLASSIFICATION_CLARIFICATION_MAX_CONFIDENCE) {
    return {
      ...result,
      needsClarification: false,
      clarificationPrompt: undefined,
    };
  }

  const alternatives = result.alternatives ?? [];
  const hasCloseAlternative = alternatives.some(
    alternative => Math.abs(alternative.confidence - result.confidence) <= 0.12
  );

  if (!hasCloseAlternative && result.confidence >= 0.3) {
    return {
      ...result,
      needsClarification: false,
      clarificationPrompt: undefined,
    };
  }

  return result;
}

export function buildClassifyClarificationState(
  classification: CaptureClassificationResult
): CaptureClarificationState | undefined {
  if (!classification.needsClarification) {
    return undefined;
  }

  return {
    stage: 'classify',
    prompt: classification.clarificationPrompt?.trim() || 'Is this a note for your library or a task list?',
    inputType: 'route_choice',
    round: 1,
  };
}

export function buildTodoClarificationState(
  generation: TodoGenerationResult,
  round: number
): CaptureClarificationState | undefined {
  if (!generation.needsClarification || !generation.clarificationPrompt?.trim()) {
    return undefined;
  }

  return {
    stage: 'generate_todos',
    prompt: generation.clarificationPrompt.trim(),
    inputType: generation.inputType === 'date' ? 'date' : 'free_text',
    round,
  };
}

export function finalizeTodoGenerationResult(
  result: TodoGenerationResult,
  clarificationRound: number
): TodoGenerationResult {
  if (!result.needsClarification || !result.clarificationPrompt?.trim()) {
    return result;
  }

  if (clarificationRound >= MAX_CAPTURE_CLARIFICATION_ROUNDS) {
    return {
      ...result,
      needsClarification: false,
      clarificationPrompt: undefined,
      inputType: undefined,
    };
  }

  return result;
}

export function buildTodoGenerationClarificationContext(
  job?: Pick<CaptureJob, 'clarificationAnswers' | 'todoGeneration'>
): CaptureTodoClarificationContext | undefined {
  const answers = job?.clarificationAnswers?.filter(entry => entry.stage === 'generate_todos') ?? [];
  const partialTodos = job?.todoGeneration?.todos;
  if (answers.length === 0 && (!partialTodos || partialTodos.length === 0)) {
    return undefined;
  }

  return {
    round: answers.length + 1,
    answers,
    partialTodos: partialTodos?.length ? partialTodos : undefined,
  };
}

export function buildAiUnavailableClassificationFallback(
  title: string,
  content: string,
  localSignals: CaptureClassifyLocalSignals
): CaptureClassificationResult {
  const obvious = inferObviousCaptureRoute(title, content, localSignals);
  if (obvious) {
    return obvious;
  }

  return {
    route: 'card',
    confidence: 0.35,
    confidenceBand: 'low',
    reasoning: 'AI classification was unavailable, so Second Mind continued with a library note route.',
    needsClarification: false,
  };
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

export function getInboxCaptureFilingSuggestion(
  capture: InboxCapture
): CardFilingSuggestion | undefined {
  return capture.enrichment?.filingSuggestion;
}

export function getInboxCaptureFilingLabel(capture: InboxCapture): string | null {
  const filing = getInboxCaptureFilingSuggestion(capture);
  if (!filing) {
    return null;
  }

  if (filing.mode === 'existing_category' && filing.suggestedCategoryTitle) {
    const range = filing.suggestedCategoryRange?.trim();
    return range ? `${range} — ${filing.suggestedCategoryTitle}` : filing.suggestedCategoryTitle;
  }

  if (filing.mode === 'new_category' && filing.suggestedNewCategoryTitle) {
    const parent = filing.suggestedParentTitle?.trim();
    return parent
      ? `New shelf under ${parent}: ${filing.suggestedNewCategoryTitle}`
      : filing.suggestedNewCategoryTitle;
  }

  if (filing.mode === 'manual_review') {
    return 'Needs filing review';
  }

  return null;
}

const normalizeComparableCaptureText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export function captureEnrichmentHasMeaningfulWork(
  capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>,
  draft: CaptureStructuringResult
): boolean {
  if (draft.strategy === 'ai' || draft.strategy === 'merged') {
    return true;
  }

  const hasSourceFill = Boolean(
    draft.suggestedSource?.title?.trim()
    || draft.suggestedSource?.author?.trim()
    || draft.suggestedSource?.url?.trim()
    || draft.suggestedSource?.page?.trim()
    || (draft.suggestedSource?.type && draft.suggestedSource.type !== 'Other')
  );

  if ((draft.suggestedTags?.length ?? 0) > 0) {
    return true;
  }

  if ((draft.suggestedRelatedAddresses?.length ?? 0) > 0) {
    return true;
  }

  if ((draft.corrections?.length ?? 0) > 0) {
    return true;
  }

  if (hasSourceFill) {
    return true;
  }

  const titleChanged = Boolean(
    draft.suggestedTitle?.trim()
    && normalizeComparableCaptureText(draft.suggestedTitle)
      !== normalizeComparableCaptureText(capture.title)
  );
  const contentChanged = Boolean(
    draft.suggestedContent?.trim()
    && normalizeComparableCaptureText(draft.suggestedContent)
      !== normalizeComparableCaptureText(capture.content)
  );

  return titleChanged || contentChanged;
}

export function inboxCaptureIsReadyToFile(capture: InboxCapture): boolean {
  const draft = getInboxCaptureStructuredDraft(capture);
  if (!draft) {
    return false;
  }

  return captureEnrichmentHasMeaningfulWork(capture, draft);
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
  jobId: string,
  filingSuggestion?: CardFilingSuggestion | null
): InboxCapture {
  const structuredDraft: InboxCaptureEnrichment = {
    structuredDraft: enrichment,
    filingSuggestion: filingSuggestion ?? undefined,
    enrichedAt: new Date().toISOString(),
    jobId,
  };

  return {
    ...capture,
    intendedType: 'card',
    enrichment: structuredDraft,
  };
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
  stage: CaptureClarificationState['stage'];
  inputType: CaptureClarificationState['inputType'];
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
    const clarification = job.clarification;
    return {
      jobId: job.id,
      captureId: job.captureId,
      stage: clarification?.stage ?? 'classify',
      inputType: clarification?.inputType ?? 'route_choice',
      prompt: clarification?.prompt?.trim()
        || job.classification?.clarificationPrompt?.trim()
        || 'Second Mind needs one detail before it can finish this capture.',
      previewTitle: preview.previewTitle,
      previewContent: preview.previewContent,
    };
  });
}

export function buildCaptureClarificationBannerHint(
  job: Pick<CaptureClarificationJobView, 'inputType' | 'stage'>
): string {
  if (job.stage === 'classify' || job.inputType === 'route_choice') {
    return 'Tap to choose library note or task list';
  }

  if (job.inputType === 'date') {
    return 'Tap to answer with a date';
  }

  return 'Tap to answer one quick question';
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

